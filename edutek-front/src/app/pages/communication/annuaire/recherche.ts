import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';
import { API_URL } from '../../../core/config';
import { Personne, normaliser } from '../modeles';

/**
 * Recherche dans l'annuaire (GET /api/annuaire?q=).
 * Le serveur compare la saisie au nom OU au prénom : « Sami Jebali » ne renvoie rien. Pour une saisie de
 * plusieurs mots, on interroge d'abord la saisie entière (noms composés comme « Ben Salah »), puis, sans
 * résultat, le mot le plus long ; on ne garde que les personnes dont chaque mot saisi commence un mot du nom complet.
 */
export function chercherPersonnes(http: HttpClient, saisie: string): Observable<Personne[]> {
  const q = saisie.trim().replace(/\s+/g, ' ');
  const mots = q.split(' ');
  const appel = (texte: string) => http.get<Personne[]>(`${API_URL}/annuaire`, { params: new HttpParams().set('q', texte) });
  if (mots.length < 2) { return appel(q).pipe(map((l) => l ?? [])); }
  const plusLong = [...mots].sort((a, b) => b.length - a.length)[0];
  const cles = mots.map(normaliser);
  const correspond = (p: Personne) => {
    const morceaux = normaliser(`${p.prenom} ${p.nom}`).split(/[\s'’-]+/);
    return cles.every((c) => morceaux.some((m) => m.startsWith(c)));
  };
  return appel(q).pipe(
    switchMap((l) => (l?.length || plusLong.length < 2 ? of(l ?? []) : appel(plusLong).pipe(map((l2) => (l2 ?? []).filter(correspond))))),
  );
}
