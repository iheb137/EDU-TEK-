import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { CalendrierItem, Evenement, SemestreDto } from './modeles';

/** Correspondances reconstituées depuis le calendrier personnel (l'étudiant n'a pas accès à /evaluations ni /seances). */
export interface Referentiel {
  evaluations: Map<number, Evenement>;
  seances: Map<number, Evenement>;
}

const UN_AN_MS = 365 * 24 * 3600 * 1000;

/** Tri du plus ancien au plus récent. */
export function trierSemestres(liste: SemestreDto[]): SemestreDto[] {
  return [...liste].sort((a, b) => (a.dateDebut ?? '').localeCompare(b.dateDebut ?? '') || a.id - b.id);
}

/** Semestre en cours (aujourd'hui entre début et fin), sinon le dernier commencé, sinon le premier. */
export function semestreCourant(liste: SemestreDto[]): SemestreDto | null {
  if (!liste.length) { return null; }
  const j = aujourdhui();
  const tri = trierSemestres(liste);
  return tri.find((s) => s.dateDebut && s.dateFin && s.dateDebut <= j && j <= s.dateFin)
    ?? [...tri].reverse().find((s) => s.dateDebut && s.dateDebut <= j)
    ?? tri[0];
}

/** Date du jour au format AAAA-MM-JJ (heure locale). */
export function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Sépare « DS : Architecture logicielle » en type et matière. */
function decouper(titre: string): { type: string; matiere: string } {
  const i = titre.indexOf(' : ');
  return i < 0 ? { type: '', matiere: titre } : { type: titre.slice(0, i).trim(), matiere: titre.slice(i + 3).trim() };
}

/** Données partagées par les écrans de l'espace étudiant (mises en cache le temps de la session). */
@Injectable({ providedIn: 'root' })
export class EspaceEtudiant {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private semestres$?: Observable<SemestreDto[]>;
  private referentiel$?: Observable<Referentiel>;
  private jeton = '';

  semestres(): Observable<SemestreDto[]> {
    this.verifierSession();
    this.semestres$ ??= this.http.get<SemestreDto[]>(`${API_URL}/semestres`).pipe(
      map(trierSemestres),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.semestres$.pipe(catchError((e) => { this.semestres$ = undefined; throw e; }));
  }

  /** Évaluations et séances de tous les semestres, indexées par identifiant. */
  referentiel(): Observable<Referentiel> {
    this.verifierSession();
    this.referentiel$ ??= this.semestres().pipe(
      // Une requête par semestre : l'API limite la période du calendrier à un an.
      switchMap((liste) => {
        const reqs = liste.filter((s) => s.dateDebut && s.dateFin).map((s) => this.calendrier(s).pipe(map((items) => ({ s, items }))));
        return reqs.length ? forkJoin(reqs) : of([]);
      }),
      map((blocs) => {
        const ref: Referentiel = { evaluations: new Map(), seances: new Map() };
        for (const { s, items } of blocs) {
          for (const it of items) {
            if (it.refId == null) { continue; }
            const { type, matiere } = decouper(it.titre ?? '');
            const ev: Evenement = { id: it.refId, semestreId: s.id, type, matiere, date: it.date, heureDebut: it.heureDebut, heureFin: it.heureFin, salle: it.salle, enseignant: it.enseignant };
            if (it.categorie === 'EXAMEN') { ev.type ||= 'Évaluation'; ref.evaluations.set(it.refId, ev); }
            if (it.categorie === 'SEANCE') { ev.type ||= 'Séance'; ref.seances.set(it.refId, ev); }
          }
        }
        return ref;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.referentiel$.pipe(catchError((e) => { this.referentiel$ = undefined; throw e; }));
  }

  private calendrier(s: SemestreDto): Observable<CalendrierItem[]> {
    let au = s.dateFin!;
    if (new Date(au).getTime() - new Date(s.dateDebut!).getTime() >= UN_AN_MS) {
      const d = new Date(new Date(s.dateDebut!).getTime() + UN_AN_MS - 24 * 3600 * 1000);
      au = d.toISOString().slice(0, 10);
    }
    return this.http.get<CalendrierItem[]>(`${API_URL}/calendrier/moi`, { params: { du: s.dateDebut!, au } }).pipe(catchError(() => of([])));
  }

  /** Vide le cache si l'utilisateur connecté a changé. */
  private verifierSession(): void {
    const t = this.auth.token() ?? '';
    if (t !== this.jeton) { this.jeton = t; this.semestres$ = undefined; this.referentiel$ = undefined; }
  }
}
