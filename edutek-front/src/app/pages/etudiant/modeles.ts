// Types et libellés de l'espace étudiant (DTO renvoyés par l'API, voir spec/API.md).

export interface SemestreDto { id: number; nom: string; dateDebut?: string; dateFin?: string; formationId: number; }

export interface NoteDto { id: number; valeur: number; commentaire?: string | null; evaluationId: number; etudiantId: number; statut?: string; }
export interface PresenceDto { id: number; present: boolean; datePointage?: string; justification?: string | null; seanceId: number; etudiantId: number; }

export interface CalendrierItem {
  categorie: string; titre: string; date: string; dateFin?: string; heureDebut?: string; heureFin?: string;
  salle?: string; classe?: string; enseignant?: string; refId?: number;
}

/** Évaluation ou séance reconstituée à partir du calendrier personnel de l'étudiant. */
export interface Evenement {
  id: number; semestreId: number; type: string; matiere: string; date: string;
  heureDebut?: string; heureFin?: string; salle?: string; enseignant?: string;
}

export interface LigneMatiere { matiereId: number; code: string; nom: string; coefficient: number; credits: number; moyenne?: number | null; valide?: boolean | null; }
export interface Bulletin { semestreId: number; semestreNom: string; etudiantId: number; moyenne?: number | null; creditsObtenus?: number | null; decision: string; matieres: LigneMatiere[]; }
export interface ResultatSemestre {
  id: number; etudiantId: number; semestreId: number; moyenne?: number | null; decision?: string; creditsObtenus?: number | null;
  rangClasse?: number | null; effectifClasse?: number | null; rangFiliere?: number | null; effectifFiliere?: number | null; statut?: string;
}

export interface Indicateur { id: number; nom: string; valeur: number; dateCalcul?: string; etudiantId: number; semestreId: number; }
export interface Recommandation { id: number; semestreId: number; categorie: string; texte: string; dateCreation?: string; lue: boolean; }

export interface Justificatif {
  id: number; etudiantId: number; dateDebut: string; dateFin: string; motif: string; commentaire?: string | null; pieceUrl?: string | null;
  statut: string; motifRejet?: string | null; dateSoumission?: string; dateDecision?: string | null; nbAbsencesJustifiees?: number | null;
}
export interface JustificatifRequete { dateDebut: string; dateFin: string; motif: string; commentaire?: string; pieceUrl?: string; }

export interface Stage { id: number; entreprise: string; sujet: string; dateDebut: string; dateFin: string; statut: string; motifRejet?: string | null; }
export interface StageRequete { entreprise: string; sujet: string; dateDebut: string; dateFin: string; }

export interface DemandeDocument {
  id: number; typeDocument: string; dateDemande?: string; statut: string; motifRejet?: string | null;
  messageRetrait?: string | null; datePret?: string | null; dateRemise?: string | null;
}

export interface ClasseVirtuelle {
  id: number; plateforme: string; lien: string; codeAcces?: string | null; dateHeure?: string; enseignementId: number;
  classeId?: number; classeNom?: string; matiereNom?: string; enseignantNom?: string;
}
export interface SupportCours { id: number; titre: string; type: string; url: string; dateDepot?: string; classeVirtuelleId: number; }

// ── Libellés ────────────────────────────────────────────────────────────────
export const MOTIFS_JUSTIFICATIF: Record<string, string> = { MALADIE: 'Maladie', FAMILIAL: 'Raison familiale', ADMINISTRATIF: 'Démarche administrative', AUTRE: 'Autre motif' };
export const STATUT_JUSTIFICATIF: Record<string, string> = { SOUMIS: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté' };
export const STATUT_STAGE: Record<string, string> = { PROPOSE: 'Proposé', VALIDE: 'Validé', REJETE: 'Rejeté' };
export const TYPES_DOCUMENT: Record<string, string> = {
  ATTESTATION_INSCRIPTION: 'Attestation d\'inscription', ATTESTATION_PRESENCE: 'Attestation de présence', RELEVE_NOTES: 'Relevé de notes', AUTRE: 'Autre document',
};
export const STATUT_DEMANDE: Record<string, string> = { SOUMIS: 'Envoyée', EN_TRAITEMENT: 'En traitement', PRET: 'Prêt à retirer', REMIS: 'Remis', REJETE: 'Rejetée' };
export const PLATEFORMES: Record<string, string> = { GOOGLE_MEET: 'Google Meet', ZOOM: 'Zoom', TEAMS: 'Microsoft Teams', AUTRE: 'Autre plateforme' };
export const TYPES_SUPPORT: Record<string, string> = { PDF: 'PDF', VIDEO: 'Vidéo', DOCUMENT: 'Document', LIEN: 'Lien', AUTRE: 'Autre' };
export const CATEGORIES_RECOMMANDATION: Record<string, string> = {
  ASSIDUITE: 'Assiduité', MATIERES_A_RATTRAPER: 'Matières à rattraper', RESULTATS: 'Résultats', PROGRESSION: 'Progression', SUIVI: 'Suivi',
};
export const DECISIONS: Record<string, string> = {
  EN_ATTENTE_PUBLICATION: 'En attente de publication', ADMIS: 'Admis', ADMIS_RATTRAPAGE: 'Admis après rattrapage', AJOURNE: 'Ajourné',
  RATTRAPAGE: 'Rattrapage', REDOUBLE: 'Redoublement', VALIDE: 'Validé', NON_VALIDE: 'Non validé',
};
export const STATUT_NOTE: Record<string, string> = { BROUILLON: 'Provisoire', SOUMISE: 'Définitive', VALIDEE: 'Définitive' };

/** Libellé lisible d'une valeur codée (repli : MOT_CODE → « Mot code »). */
export function libelle(table: Record<string, string>, code?: string | null): string {
  if (!code) { return ''; }
  if (table[code]) { return table[code]; }
  const t = code.toLowerCase().replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
