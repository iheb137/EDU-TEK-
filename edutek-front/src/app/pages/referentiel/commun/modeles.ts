/** DTO du référentiel pédagogique (formations, semestres, matières, classes, personnes, inscriptions, enseignements). */
export interface Formation { id: number; code: string; nom: string; niveau?: string | null; }
export interface Semestre { id: number; nom: string; dateDebut?: string | null; dateFin?: string | null; formationId: number; }
export interface Matiere { id: number; code: string; nom: string; coefficient?: number | null; credits?: number | null; semestreId: number; }
export interface Classe { id: number; code: string; nom: string; anneeUniversitaire?: string | null; formationId: number; }

export interface Etudiant {
  id: number; nom: string; prenom: string; email: string; telephone?: string | null; actif: boolean;
  matricule: string; niveau?: string | null; classeId?: number | null;
}
export interface Enseignant {
  id: number; nom: string; prenom: string; email: string; telephone?: string | null; actif: boolean;
  matricule: string; specialite?: string | null; grade?: string | null;
}

export interface Inscription { id: number; dateInscription?: string | null; statut?: string | null; etudiantId: number; formationId: number; }

export interface Enseignement {
  id: number; groupe?: string | null; volumeHoraire?: number | null;
  enseignantId: number; matiereId: number; classeId: number; semestreId: number;
}

export interface EvaluationAvancement { id: number; type: string; anonyme: boolean; attendues: number; brouillons: number; soumises: number; }
export interface AvancementEnseignement { id: number; cloture: boolean; dateCloture?: string | null; evaluations: EvaluationAvancement[]; }
/** Ligne de GET /api/resultats/semestres/{id}/avancement (état de clôture par enseignement). */
export interface LigneAvancement { enseignementId: number; matiere: string; classe: string; enseignant: string; cloture: boolean; brouillons: number; soumises: number; }

export interface Regles {
  formationId: number; noteMax: number; seuilAdmission: number; noteEliminatoire?: number | null;
  compensation: boolean; decimales: number; verrouillee: boolean; parDefaut: boolean;
}

export interface MatiereLigne { id: number; code: string; nom: string; coefficient?: number | null; credits?: number | null; }
export interface SemestrePlan { id: number; nom: string; dateDebut?: string | null; dateFin?: string | null; totalCredits: number; matieres: MatiereLigne[]; }
export interface PlanEtudes { formationId: number; code: string; nom: string; niveau?: string | null; totalCredits: number; semestres: SemestrePlan[]; }

/** Statuts d'inscription proposés (le backend accepte une chaîne libre ; « ACTIVE » par défaut). */
export const STATUTS_INSCRIPTION: { valeur: string; libelle: string; classe: string }[] = [
  { valeur: 'ACTIVE', libelle: 'Active', classe: 'vert' },
  { valeur: 'SUSPENDUE', libelle: 'Suspendue', classe: 'orange' },
  { valeur: 'TERMINEE', libelle: 'Terminée', classe: '' },
  { valeur: 'ANNULEE', libelle: 'Annulée', classe: 'gris' },
];

export function statutInscription(valeur?: string | null): { libelle: string; classe: string } {
  const s = STATUTS_INSCRIPTION.find((x) => x.valeur === valeur);
  return s ?? { libelle: valeur || 'Non renseigné', classe: 'gris' };
}
