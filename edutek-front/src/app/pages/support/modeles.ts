/** Modèles et libellés du module Support (justificatifs, documents, stages, calendrier). */

export interface Justificatif {
  id: number; etudiantId: number; etudiantNom: string; etudiantMatricule?: string;
  dateDebut: string; dateFin: string; motif: string; commentaire?: string | null; pieceUrl?: string | null;
  statut: string; motifRejet?: string | null; dateSoumission?: string; dateDecision?: string | null;
  traiteParId?: number | null; nbAbsencesJustifiees?: number | null;
}

export interface DemandeDocument {
  id: number; typeDocument: string; dateDemande: string; statut: string; motifRejet?: string | null;
  etudiantId: number; etudiantNom: string; etudiantMatricule?: string; traiteParId?: number | null; traiteParNom?: string | null;
  messageRetrait?: string | null; datePret?: string | null; dateRemise?: string | null; remisParNom?: string | null;
}

export interface Stage {
  id: number; entreprise: string; sujet: string; dateDebut: string; dateFin: string; statut: string;
  motifRejet?: string | null; etudiantId: number; etudiantNom: string; valideParId?: number | null;
}

export interface Evenement {
  id?: number; titre: string; type: string; dateDebut: string; dateFin?: string | null;
  description?: string | null; formationId?: number | null;
}

export interface CalendrierItem {
  categorie: string; titre: string; date: string; dateFin?: string | null; heureDebut?: string | null; heureFin?: string | null;
  salle?: string | null; classe?: string | null; enseignant?: string | null; refId?: number | null;
}

export interface ClasseVirtuelle {
  id: number; plateforme: string; lien: string; codeAcces?: string | null; dateHeure: string;
  classeNom?: string; matiereNom?: string; enseignantNom?: string;
}

export interface Formation { id: number; code: string; nom: string; }

/** Option d'un onglet de filtre par statut. */
export interface OngletStatut { valeur: string; libelle: string; }

export const STATUT_JUSTIFICATIF: Record<string, string> = { SOUMIS: 'À traiter', VALIDE: 'Validé', REJETE: 'Rejeté' };
export const MOTIF_JUSTIFICATIF: Record<string, string> = { MALADIE: 'Maladie', FAMILIAL: 'Raison familiale', ADMINISTRATIF: 'Démarche administrative', AUTRE: 'Autre motif' };

export const STATUT_DEMANDE: Record<string, string> = { SOUMIS: 'Soumise', EN_TRAITEMENT: 'En traitement', PRET: 'Prêt à retirer', REMIS: 'Remis', REJETE: 'Rejetée' };
export const TYPE_DOCUMENT: Record<string, string> = {
  ATTESTATION_PRESENCE: 'Attestation de présence', ATTESTATION_INSCRIPTION: 'Attestation d\'inscription',
  RELEVE_NOTES: 'Relevé de notes', AUTRE: 'Autre document',
};

export const STATUT_STAGE: Record<string, string> = { PROPOSE: 'Proposé', VALIDE: 'Validé', REJETE: 'Rejeté' };

export const TYPES_EVENEMENT = ['RENTREE', 'VACANCES', 'FERIE', 'FIN_SEMESTRE', 'PERIODE_EXAMENS', 'AUTRE'];
export const TYPE_EVENEMENT: Record<string, string> = {
  RENTREE: 'Rentrée', VACANCES: 'Vacances', FERIE: 'Jour férié', FIN_SEMESTRE: 'Fin de semestre',
  PERIODE_EXAMENS: 'Période d\'examens', AUTRE: 'Autre événement',
};

export const PLATEFORME: Record<string, string> = { GOOGLE_MEET: 'Google Meet', ZOOM: 'Zoom', TEAMS: 'Microsoft Teams', AUTRE: 'Autre plateforme' };

/** Classe de couleur de la puce selon le statut (puces de ui.scss). */
export function classePuce(statut: string): string {
  switch (statut) {
    case 'VALIDE': case 'PRET': case 'REMIS': return 'vert';
    case 'REJETE': return 'rouge';
    case 'SOUMIS': case 'PROPOSE': return 'orange';
    default: return '';
  }
}

/** Date ISO (AAAA-MM-JJ) locale, sans décalage de fuseau. */
export function isoJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Interprète « AAAA-MM-JJ » comme une date locale (évite le décalage UTC de `new Date('AAAA-MM-JJ')`). */
export function jourLocal(iso: string): Date {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, j);
}

/** « 5 oct. 2026 » pour une date sans heure. */
export function jourFr(iso?: string | null): string {
  return iso ? jourLocal(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/** Nombre de jours calendaires, bornes incluses. */
export function nbJours(debut: string, fin?: string | null): number {
  const d = jourLocal(debut).getTime();
  const f = jourLocal(fin || debut).getTime();
  return Math.round((f - d) / 86_400_000) + 1;
}

/** Période lisible : « 5 oct. 2026 » ou « du 28 sept. au 30 sept. 2026 ». */
export function periodeFr(debut: string, fin?: string | null): string {
  if (!fin || fin === debut) { return jourFr(debut); }
  const d = jourLocal(debut);
  const f = jourLocal(fin);
  const memeAnnee = d.getFullYear() === f.getFullYear();
  const dTxt = d.toLocaleDateString('fr-FR', memeAnnee ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return `du ${dTxt} au ${jourFr(fin)}`;
}

/** « 08:30:00 » → « 8 h 30 ». */
export function heureFr(h?: string | null): string {
  if (!h) { return ''; }
  const [hh, mm] = h.split(':');
  return `${Number(hh)} h ${mm}`;
}

/** Échappe un texte pour l'insérer dans du HTML généré (impression). */
export function echapper(t: unknown): string {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string));
}
