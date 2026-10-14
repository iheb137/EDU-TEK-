import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { ContexteEnseignant } from '../contexte';
import { Avancement, ClasseVirtuelle, EnseignementVue, LigneEnseignement, Pointage, STATUTS_POINTAGE, Seance, aujourdhui, dureeFr, heure, libellePlateforme, resumer, semestreCourant } from '../modeles';

interface SeanceVue extends Seance { libelle: string; }

/** Accueil de l'enseignant : enseignements, séances, classes virtuelles et pointages. */
@Component({
  selector: 'app-accueil-enseignant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './accueil-enseignant.html',
  styleUrls: ['../../../shared/ui.scss', '../enseignant.scss', './accueil-enseignant.scss'],
})
export class AccueilEnseignant {
  private readonly http = inject(HttpClient);
  private readonly contexte = inject(ContexteEnseignant);
  protected readonly auth = inject(Auth);
  protected readonly dateFr = dateFr;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly heure = heure;
  protected readonly dureeFr = dureeFr;
  protected readonly libellePlateforme = libellePlateforme;
  protected readonly statut = (s: string) => STATUTS_POINTAGE[s] ?? { libelle: s, classe: 'gris' };
  protected readonly estEnseignant = this.auth.a('ENSEIGNANT');

  protected readonly enseignements = signal<LigneEnseignement[]>([]);
  protected readonly seances = signal<Seance[]>([]);
  protected readonly classesVirtuelles = signal<ClasseVirtuelle[]>([]);
  protected readonly pointages = signal<Pointage[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');

  /** Enseignements du semestre le plus récent. */
  protected readonly courants = computed(() => {
    const l = this.enseignements();
    const sem = semestreCourant(l.map((x) => x.e));
    return l.filter((x) => x.e.semestreId === sem);
  });
  protected readonly semestreCourant = computed(() => this.courants()[0]?.e.semestre ?? '');
  protected readonly saisie = computed(() => {
    const l = this.courants();
    const attendues = l.reduce((s, x) => s + x.attendues, 0);
    const soumises = l.reduce((s, x) => s + x.soumises, 0);
    return { part: attendues ? Math.round((soumises / attendues) * 100) : 0, attendues, soumises, clotures: l.filter((x) => x.av?.cloture).length };
  });
  private readonly ensParId = computed(() => new Map(this.enseignements().map((x) => [x.e.id, x.e] as [number, EnseignementVue])));
  protected readonly prochainesSeances = computed<SeanceVue[]>(() => {
    const jour = aujourdhui();
    const ens = this.ensParId();
    return this.seances()
      .filter((s) => s.date >= jour && ens.has(s.enseignementId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut))
      .slice(0, 5)
      .map((s) => ({ ...s, libelle: ens.get(s.enseignementId)!.libelle }));
  });
  protected readonly aPointer = computed(() => {
    const jour = aujourdhui();
    const ens = this.ensParId();
    const pointees = new Set(this.pointages().map((p) => p.seanceId));
    return this.seances().filter((s) => s.date <= jour && !pointees.has(s.id) && ens.has(s.enseignementId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => ({ ...s, libelle: ens.get(s.enseignementId)!.libelle }));
  });
  protected readonly enAttente = computed(() => this.pointages().filter((p) => p.statut === 'EN_ATTENTE'));
  protected readonly anomalies = computed(() => this.pointages().filter((p) => p.statut === 'ANOMALIE'));
  protected readonly prochainesClasses = computed(() => {
    const t = Date.now();
    return this.classesVirtuelles().filter((c) => new Date(c.dateHeure).getTime() >= t)
      .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure)).slice(0, 4);
  });

  constructor() { this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    this.contexte.oublier();
    forkJoin({
      ens: this.contexte.enseignements(),
      seances: this.contexte.seances().pipe(catchError(() => of([] as Seance[]))),
      cv: this.http.get<ClasseVirtuelle[]>(`${API_URL}/classes-virtuelles`).pipe(catchError(() => of([] as ClasseVirtuelle[]))),
      pointages: this.estEnseignant ? this.http.get<Pointage[]>(`${API_URL}/pointages/mes-pointages`).pipe(catchError(() => of([] as Pointage[]))) : of([] as Pointage[]),
    }).subscribe({
      next: (r) => {
        this.seances.set(r.seances);
        this.classesVirtuelles.set(r.cv);
        this.pointages.set(r.pointages);
        const sem = semestreCourant(r.ens);
        const courants = r.ens.filter((e) => e.semestreId === sem);
        // Avancement chargé pour le semestre courant uniquement (les autres restent sans détail).
        const autres = r.ens.filter((e) => e.semestreId !== sem).map((e) => resumer(e, null));
        if (!courants.length) { this.enseignements.set(autres); this.chargement.set(false); return; }
        forkJoin(courants.map((e) => this.http.get<Avancement>(`${API_URL}/enseignements/${e.id}/avancement`).pipe(
          map((av) => resumer(e, av)), catchError(() => of(resumer(e, null)))))).subscribe((l) => {
          this.enseignements.set([...l, ...autres]);
          this.erreur.set('');
          this.chargement.set(false);
        });
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected jour(d: string): string { return String(new Date(d).getDate()); }
  protected mois(d: string): string { return new Date(d).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''); }
  protected delai(i: number, base = 0.08): string { return `${base + i * 0.06}s`; }
}
