import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { Classe, Enseignement, EnseignementVue, Matiere, Seance, SemestreRef } from './modeles';

interface Referentiel { matieres: Matiere[]; classes: Classe[]; semestres: SemestreRef[]; }
interface AnnuaireDto { id: number; nom: string; prenom: string; roles: string[]; }

/**
 * Données de référence partagées par les écrans du module : libellés des enseignements
 * et périmètre « mes enseignements » de l'enseignant connecté.
 *
 * Remarque : GET /api/enseignements renvoie actuellement tous les enseignements de l'établissement,
 * y compris pour un enseignant. Le périmètre est donc recalculé ici à partir des séances
 * (GET /api/seances, déjà filtré par le serveur), puis de l'annuaire en dernier recours.
 */
@Injectable({ providedIn: 'root' })
export class ContexteEnseignant {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private cache: { jeton: string | null; flux: Observable<EnseignementVue[]> } | null = null;
  private seancesCache: { jeton: string | null; flux: Observable<Seance[]> } | null = null;

  /** Vrai si le compte voit l'ensemble des enseignements (administration pédagogique). */
  estAdminPedagogie(): boolean { return this.auth.a('SUPERADMIN', 'ADMIN_PEDAGOGIQUE'); }

  /** Séances visibles par le compte (filtrées par le serveur pour un enseignant). */
  seances(): Observable<Seance[]> {
    const jeton = this.auth.token();
    if (!this.seancesCache || this.seancesCache.jeton !== jeton) {
      this.seancesCache = { jeton, flux: this.http.get<Seance[]>(`${API_URL}/seances`).pipe(shareReplay({ bufferSize: 1, refCount: false })) };
    }
    return this.seancesCache.flux;
  }

  /** Enseignements du compte connecté (tous pour l'administration pédagogique), avec libellés. */
  enseignements(): Observable<EnseignementVue[]> {
    const jeton = this.auth.token();
    if (!this.cache || this.cache.jeton !== jeton) {
      this.cache = { jeton, flux: this.charger().pipe(shareReplay({ bufferSize: 1, refCount: false })) };
      // En cas d'erreur, on ne garde pas un flux en échec dans le cache.
      this.cache.flux.subscribe({ error: () => { this.cache = null; } });
    }
    return this.cache.flux;
  }

  /** Oublie les données en cache (après une action qui les modifie). */
  oublier(): void { this.cache = null; this.seancesCache = null; }

  private charger(): Observable<EnseignementVue[]> {
    const ref$ = forkJoin({
      matieres: this.http.get<Matiere[]>(`${API_URL}/matieres`),
      classes: this.http.get<Classe[]>(`${API_URL}/classes`),
      semestres: this.http.get<SemestreRef[]>(`${API_URL}/semestres`),
    });
    const tous$ = this.http.get<Enseignement[]>(`${API_URL}/enseignements`);
    return forkJoin({ ref: ref$, tous: tous$ }).pipe(
      switchMap(({ ref, tous }) => (this.estAdminPedagogie() ? of(tous) : this.restreindre(tous)).pipe(map((l) => this.enrichir(l, ref)))),
    );
  }

  private restreindre(tous: Enseignement[]): Observable<Enseignement[]> {
    return this.seances().pipe(
      catchError(() => of([] as Seance[])),
      switchMap((seances) => {
        const vus = new Set(seances.map((s) => s.enseignementId));
        const ids = new Set(tous.filter((e) => vus.has(e.id)).map((e) => e.enseignantId));
        if (ids.size === 1) {
          const id = [...ids][0];
          return of(tous.filter((e) => e.enseignantId === id));
        }
        if (ids.size > 1) { return of(tous.filter((e) => vus.has(e.id))); }
        return this.parAnnuaire(tous);
      }),
    );
  }

  /** Dernier recours (aucune séance) : identifiant de l'enseignant retrouvé dans l'annuaire. */
  private parAnnuaire(tous: Enseignement[]): Observable<Enseignement[]> {
    const s = this.auth.session();
    if (!s?.nom) { return of([]); }
    return this.http.get<AnnuaireDto[]>(`${API_URL}/annuaire`, { params: new HttpParams().set('q', s.nom) }).pipe(
      map((l) => l.filter((a) => a.nom === s.nom && a.prenom === s.prenom && a.roles.includes('ENSEIGNANT'))),
      map((l) => (l.length === 1 ? tous.filter((e) => e.enseignantId === l[0].id) : [])),
      catchError(() => of([])),
    );
  }

  private enrichir(liste: Enseignement[], ref: Referentiel): EnseignementVue[] {
    const mat = new Map(ref.matieres.map((m) => [m.id, m]));
    const cls = new Map(ref.classes.map((c) => [c.id, c]));
    const sem = new Map(ref.semestres.map((x) => [x.id, x]));
    return liste
      .map((e) => {
        const m = mat.get(e.matiereId);
        const matiere = m?.nom ?? `Matière ${e.matiereId}`;
        const classe = cls.get(e.classeId)?.nom ?? `Classe ${e.classeId}`;
        return {
          ...e, matiere, codeMatiere: m?.code ?? '', classe,
          semestre: sem.get(e.semestreId)?.nom ?? `Semestre ${e.semestreId}`,
          semestreDebut: sem.get(e.semestreId)?.dateDebut, semestreFin: sem.get(e.semestreId)?.dateFin,
          libelle: `${matiere} · ${classe}`,
        };
      })
      .sort((a, b) => b.semestreId - a.semestreId || a.matiere.localeCompare(b.matiere, 'fr') || a.classe.localeCompare(b.classe, 'fr'));
  }
}
