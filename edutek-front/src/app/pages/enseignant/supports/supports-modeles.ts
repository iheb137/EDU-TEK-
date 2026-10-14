import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../../../core/config';

/** Enseignement et nombre de supports de cours rattachés. */
export interface EnseignementSupports {
  enseignementId: number; matiereCode: string; matiereNom: string; classeId: number; classeNom: string;
  enseignantNom: string; semestreId: number; semestreNom: string; supports: number; visibles: number; dernierDepot?: string | null;
}

export interface SupportCours {
  id: number; enseignementId: number; titre: string; chapitre?: string | null; nature: 'FICHIER' | 'LIEN';
  url?: string | null; nomFichier?: string | null; typeMime?: string | null; tailleOctets?: number | null;
  visible: boolean; dateDepot: string; deposePar?: string | null;
}

export interface GroupeChapitre { chapitre: string; supports: SupportCours[]; }

export const SANS_CHAPITRE = 'Autres supports';
export const FORMATS_ACCEPTES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.txt,.zip,.png,.jpg,.jpeg';
export const TAILLE_MAX_MO = 20;

/** Regroupe les supports par chapitre, dans l'ordre de première apparition ; « Autres supports » en dernier. */
export function grouperParChapitre(liste: SupportCours[]): GroupeChapitre[] {
  const groupes = new Map<string, SupportCours[]>();
  for (const s of liste) {
    const c = s.chapitre?.trim() || SANS_CHAPITRE;
    if (!groupes.has(c)) { groupes.set(c, []); }
    groupes.get(c)!.push(s);
  }
  return [...groupes.entries()]
    .sort(([a], [b]) => (a === SANS_CHAPITRE ? 1 : 0) - (b === SANS_CHAPITRE ? 1 : 0))
    .map(([chapitre, supports]) => ({ chapitre, supports }));
}

export function tailleFr(octets?: number | null): string {
  if (octets == null) { return ''; }
  if (octets < 1024) { return `${octets} o`; }
  if (octets < 1024 * 1024) { return `${Math.round(octets / 1024)} Ko`; }
  return `${(octets / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

/** Libellé court du format, d'après l'extension du fichier. */
export function formatFichier(s: SupportCours): string {
  if (s.nature === 'LIEN') { return 'Lien'; }
  const ext = (s.nomFichier ?? '').split('.').pop()?.toUpperCase() ?? '';
  return ext || 'Fichier';
}

/**
 * Télécharge un fichier protégé : la requête passe par HttpClient (jeton ajouté par l'intercepteur),
 * puis le navigateur enregistre le contenu reçu sous son nom d'origine.
 */
export function telechargerSupport(http: HttpClient, s: SupportCours): Observable<void> {
  return http.get(`${API_URL}/enseignements/${s.enseignementId}/supports/${s.id}/fichier`, { responseType: 'blob', observe: 'response' })
    .pipe(map((r: HttpResponse<Blob>) => {
      const url = URL.createObjectURL(r.body!);
      const a = document.createElement('a');
      a.href = url;
      a.download = s.nomFichier || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }));
}

/** Message lisible pour une erreur de téléchargement (le corps d'erreur est un Blob). */
export async function messageErreurBlob(e: unknown): Promise<string> {
  const err = e as { status?: number; error?: unknown };
  if (err?.error instanceof Blob) {
    try { const j = JSON.parse(await err.error.text()); if (j?.erreur) { return j.erreur; } } catch { /* corps non JSON */ }
  }
  return err?.status === 404 ? 'Fichier introuvable.' : 'Le téléchargement a échoué. Réessayez.';
}
