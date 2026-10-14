import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { nombreFr, telechargerTexte } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { BlocStats } from '../commun/bloc-stats';
import { DonneesPedagogiques } from '../donnees';
import { LigneAvancement, ResultatSemestre, SemestreStatistiques, libelleDecision, libelleStatutResultat } from '../modeles';

type Fenetre = null | 'calculer' | 'publier' | 'cloturer' | 'rouvrir';

/** Résultats de semestre : avancement de la clôture, calcul des moyennes et rangs, statistiques, publication. */
@Component({
  selector: 'app-resultats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Modal, BlocStats],
  templateUrl: './resultats.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/module.scss', './resultats.scss'],
})
export class Resultats {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly ref = inject(DonneesPedagogiques);
  protected readonly nombre = nombreFr;
  protected readonly decision = libelleDecision;
  protected readonly statut = libelleStatutResultat;

  protected readonly semestre = signal<number | null>(null);
  protected readonly avancement = signal<LigneAvancement[] | null>(null);
  protected readonly resultats = signal<ResultatSemestre[] | null>(null);
  protected readonly stats = signal<SemestreStatistiques | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly classe = signal<number | null>(null);
  protected readonly recherche = signal('');

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly cible = signal<LigneAvancement | null>(null);

  protected readonly nomSemestre = computed(() => this.ref.semestresParId().get(this.semestre() ?? 0)?.nom ?? '');
  protected readonly nbClotures = computed(() => (this.avancement() ?? []).filter((a) => a.cloture).length);
  protected readonly toutCloture = computed(() => { const a = this.avancement() ?? []; return a.length > 0 && a.every((x) => x.cloture); });
  protected readonly creditsSemestre = computed(() => this.ref.matieres().filter((m) => m.semestreId === this.semestre()).reduce((t, m) => t + (m.credits ?? 0), 0));
  protected readonly statuts = computed(() => {
    const c: Record<string, number> = {};
    for (const r of this.resultats() ?? []) { const s = r.statut ?? ''; c[s] = (c[s] ?? 0) + 1; }
    return c;
  });
  protected readonly toutPublie = computed(() => { const r = this.resultats() ?? []; return r.length > 0 && r.every((x) => x.statut === 'PUBLIE'); });
  protected readonly aRecalculer = computed(() => (this.resultats() ?? []).some((x) => x.statut === 'A_RECALCULER'));

  protected readonly lignes = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return (this.resultats() ?? []).map((r) => ({ r, et: this.ref.etudiantsParId().get(r.etudiantId) }))
      .filter(({ et }) => !this.classe() || et?.classeId === this.classe())
      .filter(({ r, et }) => !q || `${et?.nom ?? ''} ${et?.prenom ?? ''} ${et?.matricule ?? ''} ${r.etudiantId}`.toLowerCase().includes(q))
      .sort((a, b) => (a.r.rangFiliere ?? 1e9) - (b.r.rangFiliere ?? 1e9) || (b.r.moyenne ?? -1) - (a.r.moyenne ?? -1));
  });
  protected readonly decisionsListe = computed(() => Object.entries(this.stats()?.decisions ?? {}).sort((a, b) => b[1] - a[1]));

  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    this.ref.assurer().subscribe({
      next: () => { this.semestre.set(q.get('semestre') ? Number(q.get('semestre')) : this.ref.semestreCourant()); this.charger(); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirSemestre(v: string): void {
    this.semestre.set(v ? Number(v) : null);
    this.classe.set(null);
    this.router.navigate([], { queryParams: { semestre: this.semestre() }, replaceUrl: true });
    this.charger();
  }

  protected charger(): void {
    const s = this.semestre();
    if (!s) { this.chargement.set(false); return; }
    this.chargement.set(true);
    this.stats.set(null);
    forkJoin({
      avancement: this.http.get<LigneAvancement[]>(`${API_URL}/resultats/semestres/${s}/avancement`),
      resultats: this.http.get<ResultatSemestre[]>(`${API_URL}/resultats`, { params: new HttpParams().set('semestreId', s) }),
    }).subscribe({
      next: (r) => {
        if (this.semestre() !== s) { return; }
        this.avancement.set([...r.avancement].sort((a, b) => a.classe.localeCompare(b.classe) || a.matiere.localeCompare(b.matiere)));
        this.resultats.set(r.resultats);
        this.erreur.set('');
        this.chargement.set(false);
        // Les statistiques n'existent qu'après un calcul (409 sinon).
        if (r.resultats.length) { this.chargerStats(s); }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  private chargerStats(s: number): void {
    this.http.get<SemestreStatistiques>(`${API_URL}/resultats/semestres/${s}/statistiques`).subscribe({
      next: (st) => { if (this.semestre() === s) { this.stats.set(st); } },
      error: () => this.stats.set(null),
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  protected ouvrir(f: Exclude<Fenetre, null>, cible: LigneAvancement | null = null): void { this.cible.set(cible); this.erreurFenetre.set(''); this.fenetre.set(f); }

  protected calculer(): void {
    const s = this.semestre();
    this.executer(`${API_URL}/resultats/semestres/${s}/calcul`, (r) => `Résultats calculés pour ${(r as unknown[]).length} étudiant(s) : moyennes, décisions et rangs mis à jour.`);
  }
  protected publier(): void {
    this.executer(`${API_URL}/resultats/semestres/${this.semestre()}/publication`, () => `Résultats publiés : ils sont visibles des étudiants, qui ont été notifiés.`);
  }
  protected cloturer(): void { this.executer(`${API_URL}/enseignements/${this.cible()?.enseignementId}/cloturer`, () => `Enseignement clôturé : ${this.cible()?.matiere} · ${this.cible()?.classe}.`); }
  protected rouvrir(): void { this.executer(`${API_URL}/enseignements/${this.cible()?.enseignementId}/rouvrir`, () => `Saisie rouverte : ${this.cible()?.matiere} · ${this.cible()?.classe}.`); }

  private executer(url: string, message: (r: unknown) => string): void {
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post(url, null).subscribe({
      next: (r) => { this.enCours.set(false); this.confirmer(message(r)); this.fermer(); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected exporter(): void {
    const l = this.lignes().map(({ r, et }) => [
      et?.matricule ?? '', et?.nom ?? '', et?.prenom ?? '', this.ref.classesParId().get(et?.classeId ?? 0)?.code ?? '',
      r.moyenne === null ? '' : String(r.moyenne).replace('.', ','), r.creditsObtenus ?? '', libelleDecision(r.decision),
      r.rangClasse ? `${r.rangClasse}/${r.effectifClasse}` : '', r.rangFiliere ? `${r.rangFiliere}/${r.effectifFiliere}` : '', libelleStatutResultat(r.statut),
    ].join(';'));
    telechargerTexte(`resultats-semestre-${this.semestre()}.csv`, 'matricule;nom;prenom;classe;moyenne;credits;decision;rang classe;rang filiere;statut\n' + l.join('\n') + '\n');
  }

  protected classeDecision(d?: string | null): string {
    if (!d) { return 'gris'; }
    if (d.startsWith('ADMIS')) { return 'vert'; }
    if (d === 'EN_ATTENTE_PUBLICATION') { return 'gris'; }
    return 'orange';
  }
  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void {
    this.info.set(m);
    clearTimeout(this.minuteurInfo);
    this.minuteurInfo = setTimeout(() => this.info.set(''), 4000);
  }
}
