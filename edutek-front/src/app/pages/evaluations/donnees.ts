import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, of, shareReplay, catchError, tap } from 'rxjs';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { Classe, Enseignant, Enseignement, Etudiant, Evaluation, Matiere, Seance, Semestre } from './modeles';

/**
 * Référentiel partagé par les écrans du module : semestres, classes, matières, enseignements, étudiants.
 * Chargé une fois par session. Pour un enseignant, seuls ses enseignements sont retenus.
 */
@Injectable({ providedIn: 'root' })
export class DonneesPedagogiques {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  readonly semestres = signal<Semestre[]>([]);
  readonly classes = signal<Classe[]>([]);
  readonly matieres = signal<Matiere[]>([]);
  /** Enseignements visibles : tous pour l'administration, les siens pour un enseignant. */
  readonly enseignements = signal<Enseignement[]>([]);
  readonly etudiants = signal<Etudiant[]>([]);
  readonly enseignants = signal<Enseignant[]>([]);

  private chargement$: Observable<void> | null = null;
  private pour = '';

  /** Administration pédagogique (ou SuperAdmin) : droits étendus (correction, saisie anonyme, réouverture…). */
  readonly estAdmin = computed(() => this.auth.a('SUPERADMIN', 'ADMIN_PEDAGOGIQUE'));

  private readonly parId = <T extends { id: number }>(l: T[]) => new Map(l.map((x) => [x.id, x] as const));
  readonly semestresParId = computed(() => this.parId(this.semestres()));
  readonly classesParId = computed(() => this.parId(this.classes()));
  readonly matieresParId = computed(() => this.parId(this.matieres()));
  readonly enseignementsParId = computed(() => this.parId(this.enseignements()));
  readonly etudiantsParId = computed(() => this.parId(this.etudiants()));
  readonly enseignantsParId = computed(() => this.parId(this.enseignants()));

  /** Charge (ou recharge) le référentiel ; réutilise le chargement en cours ou terminé. */
  assurer(forcer = false): Observable<void> {
    const qui = this.auth.session()?.email ?? '';
    if (this.chargement$ && this.pour === qui && !forcer) { return this.chargement$; }
    this.pour = qui;
    const admin = this.estAdmin();
    const enseignant = !admin && this.auth.a('ENSEIGNANT');
    this.chargement$ = forkJoin({
      semestres: this.http.get<Semestre[]>(`${API_URL}/semestres`),
      classes: this.http.get<Classe[]>(`${API_URL}/classes`),
      matieres: this.http.get<Matiere[]>(`${API_URL}/matieres`),
      enseignements: this.http.get<Enseignement[]>(`${API_URL}/enseignements`),
      etudiants: this.http.get<Etudiant[]>(`${API_URL}/etudiants`),
      enseignants: admin ? this.http.get<Enseignant[]>(`${API_URL}/enseignants`).pipe(catchError(() => of([] as Enseignant[]))) : of([] as Enseignant[]),
      // L'API renvoie tous les enseignements à un enseignant : on retrouve les siens par ses évaluations et séances.
      evaluations: enseignant ? this.http.get<Evaluation[]>(`${API_URL}/evaluations`) : of([] as Evaluation[]),
      seances: enseignant ? this.http.get<Seance[]>(`${API_URL}/seances`) : of([] as Seance[]),
    }).pipe(
      tap((r) => {
        let ens = r.enseignements;
        if (enseignant) {
          const vus = new Set([...r.evaluations.map((e) => e.enseignementId), ...r.seances.map((s) => s.enseignementId)]);
          const ids = new Set(ens.filter((e) => vus.has(e.id)).map((e) => e.enseignantId));
          ens = ens.filter((e) => vus.has(e.id) || ids.has(e.enseignantId));
        }
        this.semestres.set([...r.semestres].sort((a, b) => (a.dateDebut ?? '').localeCompare(b.dateDebut ?? '') || a.id - b.id));
        this.classes.set([...r.classes].sort((a, b) => a.nom.localeCompare(b.nom)));
        this.matieres.set(r.matieres);
        this.enseignements.set(ens);
        this.etudiants.set([...r.etudiants].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)));
        this.enseignants.set(r.enseignants);
      }),
      map(() => undefined),
      shareReplay(1),
    );
    // En cas d'échec, permettre une nouvelle tentative.
    const courant = this.chargement$;
    courant.subscribe({ error: () => { if (this.chargement$ === courant) { this.chargement$ = null; } } });
    return courant;
  }

  // ── Libellés ──────────────────────────────────────────────────────────────
  matiereDe(ensId: number): Matiere | undefined {
    const e = this.enseignementsParId().get(ensId);
    return e ? this.matieresParId().get(e.matiereId) : undefined;
  }
  classeDe(ensId: number): Classe | undefined {
    const e = this.enseignementsParId().get(ensId);
    return e ? this.classesParId().get(e.classeId) : undefined;
  }
  libelleEnseignement(ensId: number): string {
    const m = this.matiereDe(ensId);
    const c = this.classeDe(ensId);
    return m ? `${m.nom} · ${c?.nom ?? ''}` : `Enseignement n° ${ensId}`;
  }
  nomEnseignant(enseignantId: number): string {
    const p = this.enseignantsParId().get(enseignantId);
    return p ? `${p.prenom} ${p.nom}` : '';
  }
  etudiantsDeClasse(classeId: number): Etudiant[] {
    return this.etudiants().filter((e) => e.classeId === classeId);
  }
  nomEtudiant(id: number): string {
    const e = this.etudiantsParId().get(id);
    return e ? `${e.prenom} ${e.nom}` : `Étudiant n° ${id}`;
  }

  /** Semestre en cours (dates englobant aujourd'hui), sinon le plus récent déjà commencé, sinon le dernier. */
  semestreCourant(): number | null {
    const l = this.semestres();
    if (!l.length) { return null; }
    const auj = new Date().toISOString().slice(0, 10);
    const enCours = l.find((s) => (s.dateDebut ?? '') <= auj && auj <= (s.dateFin ?? '9999'));
    if (enCours) { return enCours.id; }
    const passes = l.filter((s) => (s.dateDebut ?? '') <= auj);
    return (passes.at(-1) ?? l.at(-1))!.id;
  }
}
