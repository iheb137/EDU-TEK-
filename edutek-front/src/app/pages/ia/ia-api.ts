import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { API_URL } from '../../core/config';
import {
  ActionAccompagnement, AlerteIa, AvisPrediction, ClasseRef, EtudiantRef, ModeleIa, ParametresRisque, Prediction,
  ResultatAnalyse, SemestreRef, StatutAction, StatutAlerte, TypeAction,
} from './modeles';

/** Semestre par défaut des écrans : celui qui contient la date du jour, sinon le dernier commencé, sinon le plus récent. */
export function semestreParDefaut(l: SemestreRef[]): SemestreRef | null {
  const auj = new Date().toISOString().slice(0, 10);
  return l.find((s) => s.dateDebut && s.dateDebut <= auj && (!s.dateFin || s.dateFin >= auj))
    ?? l.find((s) => s.dateDebut && s.dateDebut <= auj)
    ?? l[0] ?? null;
}

/** Appels HTTP du module IA (routes /api/ia/**) et référentiels utilisés par les filtres. */
@Injectable({ providedIn: 'root' })
export class IaApi {
  private readonly http = inject(HttpClient);
  private semestres$?: Observable<SemestreRef[]>;

  // ── Alertes et accompagnement ─────────────────────────────────────────
  alertes(filtres: { semestreId?: number | null; niveau?: string | null; statut?: string | null } = {}): Observable<AlerteIa[]> {
    let p = new HttpParams();
    if (filtres.semestreId) { p = p.set('semestreId', filtres.semestreId); }
    if (filtres.niveau) { p = p.set('niveau', filtres.niveau); }
    if (filtres.statut) { p = p.set('statut', filtres.statut); }
    return this.http.get<AlerteIa[]>(`${API_URL}/ia/alertes`, { params: p });
  }
  alerte(id: number): Observable<AlerteIa> { return this.http.get<AlerteIa>(`${API_URL}/ia/alertes/${id}`); }
  changerStatutAlerte(id: number, statut: StatutAlerte): Observable<AlerteIa> {
    return this.http.patch<AlerteIa>(`${API_URL}/ia/alertes/${id}/statut`, { statut });
  }
  actions(alerteId: number): Observable<ActionAccompagnement[]> {
    return this.http.get<ActionAccompagnement[]>(`${API_URL}/ia/alertes/${alerteId}/actions`);
  }
  creerAction(alerteId: number, type: TypeAction, description: string): Observable<ActionAccompagnement> {
    return this.http.post<ActionAccompagnement>(`${API_URL}/ia/alertes/${alerteId}/actions`, { type, description });
  }
  changerStatutAction(id: number, statut: StatutAction, description?: string): Observable<ActionAccompagnement> {
    return this.http.patch<ActionAccompagnement>(`${API_URL}/ia/actions/${id}`, description ? { statut, description } : { statut });
  }

  // ── Analyses et prédictions ───────────────────────────────────────────
  predictions(filtres: { semestreId?: number | null; etudiantId?: number | null; niveau?: string | null; dernieresSeulement?: boolean } = {}): Observable<Prediction[]> {
    let p = new HttpParams();
    if (filtres.semestreId) { p = p.set('semestreId', filtres.semestreId); }
    if (filtres.etudiantId) { p = p.set('etudiantId', filtres.etudiantId); }
    if (filtres.niveau) { p = p.set('niveau', filtres.niveau); }
    if (filtres.dernieresSeulement) { p = p.set('dernieresSeulement', true); }
    return this.http.get<Prediction[]>(`${API_URL}/ia/predictions`, { params: p });
  }
  prediction(id: number): Observable<Prediction> { return this.http.get<Prediction>(`${API_URL}/ia/predictions/${id}`); }
  analyser(semestreId: number, cible: { etudiantId?: number | null; classeId?: number | null } = {}): Observable<ResultatAnalyse> {
    let p = new HttpParams().set('semestreId', semestreId);
    if (cible.etudiantId) { p = p.set('etudiantId', cible.etudiantId); }
    if (cible.classeId) { p = p.set('classeId', cible.classeId); }
    return this.http.post<ResultatAnalyse>(`${API_URL}/ia/analyses`, null, { params: p });
  }
  parametres(): Observable<ParametresRisque> { return this.http.get<ParametresRisque>(`${API_URL}/ia/parametres`); }
  modifierParametres(seuilMoyen: number, seuilEleve: number): Observable<ParametresRisque> {
    return this.http.put<ParametresRisque>(`${API_URL}/ia/parametres`, { seuilMoyen, seuilEleve });
  }
  modeles(): Observable<ModeleIa[]> { return this.http.get<ModeleIa[]>(`${API_URL}/ia/modeles`); }

  // ── Avis sur les prédictions ──────────────────────────────────────────
  avis(predictionId: number): Observable<AvisPrediction[]> {
    return this.http.get<AvisPrediction[]>(`${API_URL}/ia/predictions/${predictionId}/feedbacks`);
  }
  donnerAvis(predictionId: number, pertinent: boolean, commentaire: string): Observable<AvisPrediction> {
    const c = commentaire.trim();
    return this.http.post<AvisPrediction>(`${API_URL}/ia/predictions/${predictionId}/feedbacks`, c ? { pertinent, commentaire: c } : { pertinent });
  }

  // ── Référentiels ──────────────────────────────────────────────────────
  /** Semestres, du plus récent au plus ancien (mis en cache pour la session de navigation). */
  semestres(): Observable<SemestreRef[]> {
    this.semestres$ ??= this.http.get<SemestreRef[]>(`${API_URL}/semestres`).pipe(
      map((l) => [...l].sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? '') || b.id - a.id)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.semestres$;
  }
  classes(): Observable<ClasseRef[]> { return this.http.get<ClasseRef[]>(`${API_URL}/classes`); }
  etudiants(): Observable<EtudiantRef[]> {
    return this.http.get<EtudiantRef[]>(`${API_URL}/etudiants`).pipe(
      map((l) => [...l].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))),
    );
  }
}
