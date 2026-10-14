/** Modèles de données du module IA (alertes, accompagnement, prédictions, avis, paramètres). */

export type NiveauRisque = 'FAIBLE' | 'MOYEN' | 'ELEVE';
export type StatutAlerte = 'OUVERTE' | 'EN_COURS' | 'TRAITEE' | 'CLASSEE';
export type StatutAction = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
export type TypeAction = 'ENTRETIEN' | 'TUTORAT' | 'ORIENTATION' | 'SOUTIEN_PEDAGOGIQUE' | 'AUTRE';

export interface AlerteIa {
  id: number;
  predictionId: number;
  etudiantId: number;
  etudiantNom: string;
  etudiantMatricule: string;
  semestreId: number;
  niveau: NiveauRisque;
  score: number;
  statut: StatutAlerte;
  dateDetection: string;
  nbActions: number;
}

export interface ActionAccompagnement {
  id: number;
  alerteId: number;
  type: TypeAction;
  description: string;
  statut: StatutAction;
  dateCreation: string;
  creeParId?: number | null;
}

export interface Facteur { nom: string; valeur: number; contribution: number; }

export interface Prediction {
  id: number;
  etudiantId: number;
  etudiantNom: string;
  etudiantMatricule: string;
  semestreId: number;
  type: string;
  probabilite: number;
  niveau: NiveauRisque;
  datePrediction: string;
  modeleNom: string;
  modeleVersion: string;
  alerteId: number | null;
  facteurs: Facteur[];
}

export interface AvisPrediction {
  id: number;
  predictionId: number;
  auteurId: number;
  pertinent: boolean;
  commentaire: string | null;
  dateAvis: string;
}

export interface ResultatAnalyse {
  semestreId: number;
  analyses: number;
  alertesCreees: number;
  predictions: Prediction[];
  avertissements: string[];
}

export interface ParametresRisque {
  seuilMoyen: number;
  seuilEleve: number;
  dateModification?: string | null;
  modifieParId?: number | null;
}

export interface ModeleIa { id: number; nom: string; version: string; type: string; statut: string; }

/** Référentiels utilisés par les filtres (formes minimales des réponses de l'API). */
export interface SemestreRef { id: number; nom: string; dateDebut?: string; dateFin?: string; formationId?: number; }
export interface ClasseRef { id: number; code: string; nom: string; anneeUniversitaire?: string; formationId?: number; }
export interface EtudiantRef { id: number; nom: string; prenom: string; matricule: string; classeId?: number | null; }
