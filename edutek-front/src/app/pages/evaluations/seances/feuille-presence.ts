import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, map, of, catchError } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { DonneesPedagogiques } from '../donnees';
import { Etudiant, Presence, Seance, heureCourte } from '../modeles';

interface Pointage { present: boolean | null; justification: string; }
interface Ligne { etudiant: Etudiant; presence?: Presence; present: boolean | null; justification: string; modifiee: boolean; erreur?: string; }

/** Feuille de présence d'une séance : tous les étudiants de la classe, présent ou absent, justification. */
@Component({
  selector: 'app-feuille-presence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './feuille-presence.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/module.scss', './feuille-presence.scss'],
  host: { '(window:beforeunload)': 'avantDeQuitter($event)' },
})
export class FeuillePresence {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  protected readonly ref = inject(DonneesPedagogiques);
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly date = dateFr;
  protected readonly dateHeure = dateHeureFr;
  protected readonly heure = heureCourte;

  protected readonly seance = signal<Seance | null>(null);
  protected readonly presences = signal<Presence[]>([]);
  protected readonly pointages = signal<Record<number, Pointage>>({});
  protected readonly erreursLigne = signal<Record<number, string>>({});
  protected readonly chargement = signal(true);
  protected readonly enregistrement = signal(false);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly recherche = signal('');

  protected readonly enseignement = computed(() => { const s = this.seance(); return s ? this.ref.enseignementsParId().get(s.enseignementId) : undefined; });
  protected readonly matiere = computed(() => { const s = this.seance(); return s ? this.ref.matiereDe(s.enseignementId) : undefined; });
  protected readonly classe = computed(() => { const s = this.seance(); return s ? this.ref.classeDe(s.enseignementId) : undefined; });

  protected readonly lignes = computed<Ligne[]>(() => {
    const ens = this.enseignement();
    if (!ens) { return []; }
    const parEtudiant = new Map(this.presences().map((p) => [p.etudiantId, p] as const));
    const pts = this.pointages();
    const errs = this.erreursLigne();
    return this.ref.etudiantsDeClasse(ens.classeId).map((et) => {
      const p = parEtudiant.get(et.id);
      const origine: Pointage = { present: p ? p.present : null, justification: p?.justification ?? '' };
      const cour = pts[et.id] ?? origine;
      return {
        etudiant: et, presence: p, present: cour.present, justification: cour.justification, erreur: errs[et.id],
        modifiee: !!pts[et.id] && (cour.present !== origine.present || cour.justification.trim() !== origine.justification.trim()),
      };
    });
  });
  protected readonly lignesAffichees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return q ? this.lignes().filter((l) => `${l.etudiant.nom} ${l.etudiant.prenom} ${l.etudiant.matricule}`.toLowerCase().includes(q)) : this.lignes();
  });
  protected readonly compteurs = computed(() => {
    const l = this.lignes();
    const presents = l.filter((x) => x.present === true).length;
    const absents = l.filter((x) => x.present === false).length;
    const justifies = l.filter((x) => x.present === false && x.justification.trim()).length;
    return { total: l.length, presents, absents, justifies, nonPointes: l.length - presents - absents };
  });
  protected readonly nbModifiees = computed(() => this.lignes().filter((l) => l.modifiee).length);

  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.ref.assurer().subscribe({ next: () => this.charger(), error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); } });
  }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      seance: this.http.get<Seance>(`${API_URL}/seances/${this.id}`),
      presences: this.http.get<Presence[]>(`${API_URL}/seances/${this.id}/presences`),
    }).subscribe({
      next: (r) => { this.seance.set(r.seance); this.presences.set(r.presences); this.chargement.set(false); this.erreur.set(''); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected pointer(l: Ligne, present: boolean): void {
    this.modifier(l, { present, justification: present ? '' : l.justification });
  }
  protected justifier(l: Ligne, justification: string): void { this.modifier(l, { present: l.present, justification }); }

  private modifier(l: Ligne, p: Pointage): void {
    this.pointages.update((s) => ({ ...s, [l.etudiant.id]: p }));
    if (l.erreur) { this.erreursLigne.update((e) => { const n = { ...e }; delete n[l.etudiant.id]; return n; }); }
  }

  /** Marque présents tous les étudiants encore non pointés. */
  protected tousPresents(): void {
    this.pointages.update((s) => {
      const n = { ...s };
      for (const l of this.lignes()) { if (l.present === null) { n[l.etudiant.id] = { present: true, justification: '' }; } }
      return n;
    });
  }

  protected annuler(): void { this.pointages.set({}); this.erreursLigne.set({}); }

  protected enregistrer(): void {
    const aEnvoyer = this.lignes().filter((l) => l.modifiee && l.present !== null);
    if (!aEnvoyer.length || this.enregistrement()) { return; }
    this.enregistrement.set(true);
    this.erreur.set('');
    forkJoin(aEnvoyer.map((l) => {
      const corps: Presence = { present: l.present!, justification: l.present ? null : (l.justification.trim() || null), seanceId: this.id, etudiantId: l.etudiant.id };
      const req = l.presence?.id
        ? this.http.put<Presence>(`${API_URL}/presences/${l.presence.id}`, { ...l.presence, ...corps })
        : this.http.post<Presence>(`${API_URL}/presences`, corps);
      return req.pipe(map(() => ({ l, ok: true, m: '' })), catchError((e: unknown) => of({ l, ok: false, m: Auth.message(e) })));
    })).subscribe((res) => {
      this.enregistrement.set(false);
      const ok = res.filter((r) => r.ok);
      const ko = res.filter((r) => !r.ok);
      this.pointages.update((s) => { const n = { ...s }; for (const r of ok) { delete n[r.l.etudiant.id]; } return n; });
      const errs: Record<number, string> = {};
      for (const r of ko) { errs[r.l.etudiant.id] = r.m; }
      this.erreursLigne.set(errs);
      if (ko.length) { this.erreur.set(`${ko.length} pointage(s) non enregistré(s) : ${ko[0].l.etudiant.prenom} ${ko[0].l.etudiant.nom} : ${ko[0].m}`); }
      if (ok.length) { this.confirmer(`Appel enregistré (${ok.length} élève${ok.length > 1 ? 's' : ''}).` + (this.auth.a('ENSEIGNANT') && !this.auth.a('ADMIN_PEDAGOGIQUE', 'SUPERADMIN') ? ' La séance est pointée automatiquement pour le service financier.' : '')); }
      this.http.get<Presence[]>(`${API_URL}/seances/${this.id}/presences`).subscribe({ next: (p) => this.presences.set(p) });
    });
  }

  protected avantDeQuitter(e: BeforeUnloadEvent): void { if (this.nbModifiees()) { e.preventDefault(); } }
  private confirmer(m: string): void {
    this.info.set(m);
    clearTimeout(this.minuteurInfo);
    this.minuteurInfo = setTimeout(() => this.info.set(''), 4000);
  }
}
