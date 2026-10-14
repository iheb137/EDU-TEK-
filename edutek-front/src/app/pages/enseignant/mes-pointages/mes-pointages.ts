import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { ContexteEnseignant } from '../contexte';
import { EnseignementVue, Pointage, STATUTS_POINTAGE, Seance, aujourdhui, dureeFr, heure, minutesEntre, periodeFr } from '../modeles';

export interface SeanceAPointer extends Seance { libelle: string; minutes: number; }
type Onglet = 'apointer' | 'pointages';

/** Pointage des séances effectuées par l'enseignant et suivi de leur traitement par la finance. */
@Component({
  selector: 'app-mes-pointages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './mes-pointages.html',
  styleUrls: ['../../../shared/ui.scss', '../enseignant.scss'],
})
export class MesPointages {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly contexte = inject(ContexteEnseignant);
  protected readonly dateFr = dateFr;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dureeFr = dureeFr;
  protected readonly heure = heure;
  protected readonly periodeFr = periodeFr;
  protected readonly statut = (s: string) => STATUTS_POINTAGE[s] ?? { libelle: s, classe: 'gris' };

  protected readonly seances = signal<Seance[]>([]);
  protected readonly enseignements = signal<EnseignementVue[]>([]);
  protected readonly pointages = signal<Pointage[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly onglet = signal<Onglet>('apointer');
  protected readonly periode = signal('');

  protected readonly fenetre = signal<null | 'pointer' | 'modifier' | 'retirer' | 'detail'>(null);
  protected readonly seanceCible = signal<SeanceAPointer | null>(null);
  protected readonly pointageCible = signal<Pointage | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  protected readonly formulaire = this.fb.nonNullable.group({
    minutes: [90, [Validators.required, Validators.min(1), Validators.max(720)]],
    commentaire: ['', Validators.maxLength(500)],
  });

  private seanceDemandee: number | null = null;

  /** Séances passées (ou du jour) de l'enseignant qui n'ont pas encore été pointées. */
  protected readonly aPointer = computed<SeanceAPointer[]>(() => {
    const jour = aujourdhui();
    const pointees = new Set(this.pointages().map((p) => p.seanceId));
    const ens = new Map(this.enseignements().map((e) => [e.id, e]));
    const p = this.periode();
    return this.seances()
      .filter((s) => s.date <= jour && !pointees.has(s.id) && ens.has(s.enseignementId) && (!p || s.date.startsWith(p)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.heureDebut.localeCompare(a.heureDebut))
      .map((s) => ({ ...s, libelle: ens.get(s.enseignementId)!.libelle, minutes: minutesEntre(s.heureDebut, s.heureFin) }));
  });
  protected readonly pointagesVisibles = computed(() => {
    const p = this.periode();
    return this.pointages().filter((x) => !p || x.date.startsWith(p));
  });
  protected readonly periodes = computed(() => {
    const jour = aujourdhui();
    const m = new Set<string>();
    this.seances().filter((s) => s.date <= jour).forEach((s) => m.add(s.date.slice(0, 7)));
    this.pointages().forEach((x) => m.add(x.date.slice(0, 7)));
    return [...m].sort().reverse();
  });
  protected readonly totaux = computed(() => {
    const l = this.pointagesVisibles();
    return {
      enAttente: l.filter((x) => x.statut === 'EN_ATTENTE').length,
      anomalies: l.filter((x) => x.statut === 'ANOMALIE').length,
      minutesRetenues: l.filter((x) => x.statut === 'VALIDE' || x.statut === 'CORRIGE').reduce((s, x) => s + (x.minutesValidees ?? 0), 0),
    };
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const id = Number(q.get('seanceId'));
    this.seanceDemandee = id > 0 ? id : null;
    if (q.get('onglet') === 'pointages') { this.onglet.set('pointages'); }
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.contexte.oublier();
    forkJoin({
      seances: this.contexte.seances().pipe(catchError(() => of([] as Seance[]))),
      enseignements: this.contexte.enseignements(),
      pointages: this.http.get<Pointage[]>(`${API_URL}/pointages/mes-pointages`),
    }).subscribe({
      next: (r) => {
        this.seances.set(r.seances);
        this.enseignements.set(r.enseignements);
        this.pointages.set(r.pointages);
        this.erreur.set('');
        this.chargement.set(false);
        if (this.seanceDemandee) {
          const s = this.aPointer().find((x) => x.id === this.seanceDemandee);
          this.seanceDemandee = null;
          if (s) { this.ouvrirPointage(s); }
        }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirPeriode(v: string): void { this.periode.set(v); }

  // ── Pointer une séance ──────────────────────────────────────────────────
  protected ouvrirPointage(s: SeanceAPointer): void {
    this.seanceCible.set(s);
    this.formulaire.reset({ minutes: s.minutes, commentaire: '' });
    this.erreurFenetre.set('');
    this.fenetre.set('pointer');
  }

  protected pointer(): void {
    this.formulaire.markAllAsTouched();
    const s = this.seanceCible();
    if (this.formulaire.invalid || !s) { return; }
    const v = this.formulaire.getRawValue();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Pointage>(`${API_URL}/pointages`, { seanceId: s.id, minutes: Number(v.minutes), commentaire: v.commentaire.trim() || null }).subscribe({
      next: (p) => {
        this.enCours.set(false);
        this.fermer();
        this.pointages.update((l) => [p, ...l]);
        this.confirmer(`Séance du ${dateFr(p.date)} pointée (${dureeFr(p.minutesDeclarees)}). Elle est transmise à la finance.`);
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Modifier / retirer un pointage en attente ───────────────────────────
  protected ouvrir(f: 'modifier' | 'retirer' | 'detail', p: Pointage): void {
    this.pointageCible.set(p);
    if (f === 'modifier') { this.formulaire.reset({ minutes: p.minutesDeclarees, commentaire: p.commentaire ?? '' }); }
    this.erreurFenetre.set('');
    this.fenetre.set(f);
  }

  protected modifier(): void {
    this.formulaire.markAllAsTouched();
    const p = this.pointageCible();
    if (this.formulaire.invalid || !p) { return; }
    const v = this.formulaire.getRawValue();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.put<Pointage>(`${API_URL}/pointages/${p.id}`, { minutes: Number(v.minutes), commentaire: v.commentaire.trim() || null }).subscribe({
      next: (maj) => { this.enCours.set(false); this.fermer(); this.pointages.update((l) => l.map((x) => (x.id === maj.id ? maj : x))); this.confirmer('Pointage modifié.'); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected retirer(): void {
    const p = this.pointageCible();
    if (!p) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/pointages/${p.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.pointages.update((l) => l.filter((x) => x.id !== p.id)); this.confirmer('Pointage retiré : la séance est de nouveau à pointer.'); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
