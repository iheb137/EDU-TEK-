// Modèles propres au module « évaluations » (évaluations, notes, séances, présences, résultats, indicateurs).

export interface Semestre { id: number; nom: string; dateDebut?: string; dateFin?: string; formationId: number; }
export interface Classe { id: number; code: string; nom: string; anneeUniversitaire?: string; formationId: number; }
export interface Matiere { id: number; code: string; nom: string; coefficient?: number; credits?: number; semestreId: number; }
export interface Enseignement { id: number; groupe?: string; volumeHoraire?: number; enseignantId: number; matiereId: number; classeId: number; semestreId: number; }
export interface Enseignant { id: number; nom: string; prenom: string; email: string; }
export interface Etudiant { id: number; nom: string; prenom: string; email: string; matricule: string; niveau?: string; classeId?: number; actif?: boolean; }

export interface Evaluation {
  id: number; type: string; date?: string | null; coefficient?: number | null; enseignementId: number;
  heureDebut?: string | null; dureeMinutes?: number | null; salle?: string | null; anonyme?: boolean;
}
export type StatutNote = 'BROUILLON' | 'SOUMISE' | string;
export interface Note { id?: number; valeur: number; commentaire?: string | null; evaluationId: number; etudiantId: number; statut?: StatutNote; }

export interface EvaluationAvancement { id: number; type: string; anonyme: boolean; attendues: number; brouillons: number; soumises: number; }
export interface AvancementEnseignement { id: number; cloture: boolean; dateCloture?: string | null; evaluations: EvaluationAvancement[]; }
export interface LigneAvancement { enseignementId: number; matiere: string; classe: string; enseignant: string; cloture: boolean; brouillons: number; soumises: number; }

export interface Tranche { libelle: string; nombre: number; }
export interface Stats {
  effectif: number; moyenne: number | null; mediane: number | null; ecartType: number | null;
  min: number | null; max: number | null; tauxReussite: number | null; distribution: Tranche[];
}
export interface EvaluationStatistiques {
  evaluationId: number; type: string; date?: string; attendus: number; saisies: number; brouillons: number;
  inclutBrouillons: boolean; seuilReussite: number; noteMax: number; stats: Stats;
}
export interface ClasseStatistiques { classeId: number; code: string; stats: Stats; decisions: Record<string, number>; }
export interface SemestreStatistiques {
  semestreId: number; semestre: string; seuilReussite: number; noteMax: number; filiere: Stats;
  decisions: Record<string, number>; classes: ClasseStatistiques[];
}

export interface ImportNotesResultat {
  simulation: boolean; lignesLues: number; lignesValides: number; notesCreees: number; statutDesNotes: string;
  erreurs: { ligne: number; message: string }[];
}

export interface Seance { id: number; date: string; heureDebut: string; heureFin: string; salle?: string | null; enseignementId: number; }
export interface Presence { id?: number; present: boolean; datePointage?: string | null; justification?: string | null; seanceId: number; etudiantId: number; }

export interface ResultatSemestre {
  id: number; etudiantId: number; semestreId: number; moyenne: number | null; decision: string | null; creditsObtenus: number | null;
  rangClasse: number | null; effectifClasse: number | null; rangFiliere: number | null; effectifFiliere: number | null; statut: string | null;
}
export interface Indicateur { id: number; nom: string; valeur: number; dateCalcul: string; etudiantId: number; semestreId: number; }

/** Types d'évaluation proposés (le champ reste libre côté API). */
export const TYPES_EVALUATION: { code: string; libelle: string }[] = [
  { code: 'DS', libelle: 'Devoir surveillé' },
  { code: 'EXAMEN', libelle: 'Examen' },
  { code: 'TP', libelle: 'Travaux pratiques' },
  { code: 'PROJET', libelle: 'Projet' },
  { code: 'ORAL', libelle: 'Oral' },
  { code: 'CONTROLE_CONTINU', libelle: 'Contrôle continu' },
];
export function libelleType(code?: string | null): string {
  return TYPES_EVALUATION.find((t) => t.code === code)?.libelle ?? (code ?? '');
}

export const LIBELLE_STATUT_NOTE: Record<string, string> = { BROUILLON: 'Brouillon', SOUMISE: 'Soumise' };

export const LIBELLE_DECISION: Record<string, string> = {
  ADMIS: 'Admis', ADMIS_PAR_COMPENSATION: 'Admis par compensation', ADMIS_COMPENSATION: 'Admis par compensation',
  AJOURNE: 'Ajourné', REDOUBLE: 'Redouble', ELIMINE: 'Éliminé', EN_ATTENTE_PUBLICATION: 'En attente de publication',
  NON_ADMIS: 'Non admis', RATTRAPAGE: 'Rattrapage',
};
export function libelleDecision(d?: string | null): string {
  if (!d) { return ''; }
  return LIBELLE_DECISION[d] ?? d.charAt(0) + d.slice(1).toLowerCase().replace(/_/g, ' ');
}

export const LIBELLE_STATUT_RESULTAT: Record<string, string> = {
  CALCULE: 'Calculé', PUBLIE: 'Publié', A_RECALCULER: 'À recalculer', BROUILLON: 'Non publié',
};
export function libelleStatutResultat(s?: string | null): string {
  if (!s) { return ''; }
  return LIBELLE_STATUT_RESULTAT[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** Indicateurs académiques connus : libellé et format d'affichage. */
export const INDICATEURS: { nom: string; libelle: string; format: 'note' | 'entier' | 'taux' }[] = [
  { nom: 'MOYENNE_SEMESTRE', libelle: 'Moyenne du semestre', format: 'note' },
  { nom: 'CREDITS_OBTENUS', libelle: 'Crédits obtenus', format: 'entier' },
  { nom: 'NB_MATIERES_NON_VALIDEES', libelle: 'Matières non validées', format: 'entier' },
  { nom: 'NB_SEANCES_POINTEES', libelle: 'Séances pointées', format: 'entier' },
  { nom: 'TAUX_ABSENCE', libelle: "Taux d'absence", format: 'taux' },
  { nom: 'TAUX_ABSENCE_NON_JUSTIFIEE', libelle: 'Absences non justifiées', format: 'taux' },
];

/** « 09:00:00 » → « 09:00 ». */
export function heureCourte(h?: string | null): string { return h ? h.slice(0, 5) : ''; }

/** Lit une note saisie au clavier (« 12,5 » ou « 12.5 »). Renvoie null si vide, NaN si illisible. */
export function lireNote(brut: string): number | null {
  const t = brut.trim().replace(',', '.');
  if (!t) { return null; }
  return /^\d{1,2}(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}
