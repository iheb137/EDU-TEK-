import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { IaApi, semestreParDefaut } from '../ia-api';
import { NIVEAUX, STATUTS_ALERTE, libelleNiveau, libelleStatutAlerte, pourcentScore } from '../libelles';
import { AlerteIa, SemestreRef } from '../modeles';

const PLURIEL_STATUT: Record<string, string> = { OUVERTE: 'Ouvertes', EN_COURS: 'En cours', TRAITEE: 'Traitées', CLASSEE: 'Classées' };
const COULEUR_STATUT: Record<string, string> = { OUVERTE: '#3d5bd6', EN_COURS: '#f0a01c', TRAITEE: '#2fb98d', CLASSEE: '#9aa6c4' };
const TAILLE_PAGE = 20;

/** Liste des alertes de risque : filtres (statut, niveau, semestre), compteurs par statut, tri par score. */
@Component({
  selector: 'app-alertes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './alertes.html',
  styleUrls: ['../../../shared/ui.scss', '../ia.scss', './alertes.scss'],
})
export class Alertes {
  private readonly api = inject(IaApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly niveaux = NIVEAUX;
  protected readonly statuts = STATUTS_ALERTE;
  protected readonly libelleNiveau = libelleNiveau;
  protected readonly libelleStatut = libelleStatutAlerte;
  protected readonly pourcent = pourcentScore;
  protected readonly date = dateFr;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly semestres = signal<SemestreRef[]>([]);
  protected readonly alertes = signal<AlerteIa[]>([]);

  protected readonly semestreId = signal<number | null>(null);
  protected readonly niveau = signal('');
  protected readonly statut = signal('');
  protected readonly recherche = signal('');
  protected readonly tri = signal<'desc' | 'asc'>('desc');
  protected readonly page = signal(0);

  protected readonly nomSemestre = computed(() => {
    const m = new Map(this.semestres().map((s) => [s.id, s.nom]));
    return (id: number) => m.get(id) ?? `Semestre ${id}`;
  });

  protected readonly compteurs = computed(() => {
    const l = this.alertes();
    return [
      { statut: '', libelle: 'Toutes', nombre: l.length, couleur: 'var(--ink)' },
      ...STATUTS_ALERTE.map((s) => ({ statut: s, libelle: PLURIEL_STATUT[s], nombre: l.filter((a) => a.statut === s).length, couleur: COULEUR_STATUT[s] })),
    ];
  });

  protected readonly filtrees = computed(() => {
    const q = this.normaliser(this.recherche());
    const s = this.statut();
    const sens = this.tri() === 'desc' ? -1 : 1;
    return this.alertes()
      .filter((a) => !s || a.statut === s)
      .filter((a) => !q || this.normaliser(`${a.etudiantNom} ${a.etudiantMatricule}`).includes(q))
      .sort((a, b) => sens * (a.score - b.score) || b.id - a.id);
  });

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.filtrees().length / TAILLE_PAGE)));
  protected readonly visibles = computed(() => {
    const p = Math.min(this.page(), this.pages() - 1);
    return this.filtrees().slice(p * TAILLE_PAGE, (p + 1) * TAILLE_PAGE);
  });

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    this.statut.set(STATUTS_ALERTE.includes(q.get('statut') as never) ? q.get('statut')! : '');
    this.niveau.set(NIVEAUX.includes(q.get('niveau') as never) ? q.get('niveau')! : '');
    const sem = q.get('semestre');
    this.api.semestres().subscribe({
      next: (l) => {
        this.semestres.set(l);
        if (sem === 'tous') { this.semestreId.set(null); }
        else if (sem && l.some((s) => s.id === Number(sem))) { this.semestreId.set(Number(sem)); }
        else { this.semestreId.set(semestreParDefaut(l)?.id ?? null); }
        this.charger();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.api.alertes({ semestreId: this.semestreId(), niveau: this.niveau() || null }).subscribe({
      next: (l) => { this.alertes.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirSemestre(v: string): void { this.semestreId.set(v === 'tous' ? null : Number(v)); this.page.set(0); this.majUrl(); this.charger(); }
  protected choisirNiveau(v: string): void { this.niveau.set(v); this.page.set(0); this.majUrl(); this.charger(); }
  protected choisirStatut(v: string): void { this.statut.set(v); this.page.set(0); this.majUrl(); }
  protected chercher(v: string): void { this.recherche.set(v); this.page.set(0); }
  protected inverserTri(): void { this.tri.update((t) => (t === 'desc' ? 'asc' : 'desc')); this.page.set(0); }
  protected aller(delta: number): void { this.page.update((p) => Math.min(this.pages() - 1, Math.max(0, p + delta))); }
  protected reinitialiser(): void { this.statut.set(''); this.niveau.set(''); this.recherche.set(''); this.page.set(0); this.majUrl(); this.charger(); }
  protected ouvrir(a: AlerteIa): void { this.router.navigate(['/alertes', a.id]); }

  private majUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route, replaceUrl: true,
      queryParams: { statut: this.statut() || null, niveau: this.niveau() || null, semestre: this.semestreId() ?? 'tous' },
    });
  }

  private normaliser(t: string): string { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
}
