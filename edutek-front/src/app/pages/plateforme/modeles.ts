/** DTO et libellés du module « plateforme » (SuperAdmin). */

export interface Etablissement { id: number; code: string; nom: string; actif: boolean; dateCreation?: string; }

export interface Workflow {
  id: number; nom: string; actif: boolean; dateCreation?: string; dernierStatut?: string | null;
  derniereExecution?: string | null; nbExecutions: number; nbEchecs: number;
}
export interface Execution {
  id: number; workflowId: number; workflow: string; statut: string; idExterne?: string | null;
  dureeMs?: number | null; resultat?: string | null; dateExecution: string; alerteId?: number | null;
}
export interface AlerteTechnique {
  id: number; type: string; niveau: string; statut: string; message: string; source?: string | null;
  dateCreation: string; dateTraitement?: string | null; executionId?: number | null; superviseParId?: number | null;
}

/**
 * Modèle d'IA. L'API ne renvoie aujourd'hui que id, nom, version, type et statut ;
 * `donnees` et `metriques` sont lus s'ils apparaissent un jour (le service IA les connaît).
 */
export interface ModeleIa {
  id: number; nom: string; version: string; type: string; statut: string;
  donnees?: string | null; metriques?: Record<string, number> | null;
}
export interface EvaluationModele {
  modele: ModeleIa; nbEtudiants: number; exclus: number; echantillonSuffisant: boolean; positifsReels: number;
  vp: number; fp: number; vn: number; fn: number;
  precision: number | null; rappel: number | null; f1: number | null; exactitude: number | null; brier: number | null; auc: number | null;
}
export interface EvaluationResultat { semestreId: number; classeId?: number | null; seuil: number; avertissement?: string | null; modeles: EvaluationModele[]; }

export interface RoleDetail { id: number; nom: string; systeme: boolean; permissions: string[]; }
export interface Permission { id: number; code: string; description?: string | null; }
export interface Administrateur { id: number; nom: string; prenom: string; email: string; telephone?: string | null; actif: boolean; roles: string[]; }
export interface SemestreCourt { id: number; nom: string; }
export interface ClasseCourte { id: number; code: string; nom: string; }

export const LIBELLE_STATUT_MODELE: Record<string, string> = {
  ENTRAINE: 'Entraîné', EN_PRODUCTION: 'En production', ARCHIVE: 'Archivé', STUB: 'Faux service (règles)',
};
export const LIBELLE_TYPE_MODELE: Record<string, string> = {
  BASELINE: 'Modèle de référence', BASELINE_REGLES: 'Règles écrites à la main', DEEP_LEARNING: 'Apprentissage profond', AUTRE: 'Autre',
};
export const LIBELLE_STATUT_EXECUTION: Record<string, string> = { SUCCES: 'Succès', ECHEC: 'Échec', EN_COURS: 'En cours' };
export const LIBELLE_STATUT_ALERTE: Record<string, string> = { OUVERTE: 'Ouverte', ACQUITTEE: 'Acquittée', RESOLUE: 'Résolue' };
export const LIBELLE_NIVEAU: Record<string, string> = { INFO: 'Information', MOYEN: 'Moyen', ELEVE: 'Élevé', CRITIQUE: 'Critique' };

/** Transitions de statut autorisées par l'API pour une alerte technique. */
export const TRANSITIONS_ALERTE: Record<string, string[]> = { OUVERTE: ['ACQUITTEE', 'RESOLUE'], ACQUITTEE: ['RESOLUE'], RESOLUE: [] };

/** Transitions de statut autorisées par l'API pour un modèle (le statut STUB n'est pas modifiable). */
export const TRANSITIONS_MODELE: Record<string, { cible: string; libelle: string; icone: string }[]> = {
  ENTRAINE: [{ cible: 'EN_PRODUCTION', libelle: 'Mettre en production', icone: 'trending-up' }, { cible: 'ARCHIVE', libelle: 'Archiver', icone: 'archive' }],
  EN_PRODUCTION: [{ cible: 'ENTRAINE', libelle: 'Retirer de la production', icone: 'return-up-back' }, { cible: 'ARCHIVE', libelle: 'Archiver', icone: 'archive' }],
  ARCHIVE: [{ cible: 'ENTRAINE', libelle: 'Restaurer', icone: 'refresh' }],
};

export type SourceDonnees = 'SYNTHETIQUE' | 'REELLE' | 'AUCUNE' | 'INCONNUE';

/** Provenance des données d'entraînement d'un modèle (champ `donnees` s'il est fourni, sinon déduite du nom). */
export function sourceDonnees(m: ModeleIa): SourceDonnees {
  const d = (m.donnees ?? '').toUpperCase();
  if (d.startsWith('SYNTH')) { return 'SYNTHETIQUE'; }
  if (d) { return 'REELLE'; }
  if (m.statut === 'STUB' || m.type === 'BASELINE_REGLES') { return 'AUCUNE'; }
  if (/synth/i.test(`${m.nom} ${m.version}`)) { return 'SYNTHETIQUE'; }
  return 'INCONNUE';
}

export const LIBELLE_SOURCE: Record<SourceDonnees, string> = {
  SYNTHETIQUE: 'Données synthétiques', REELLE: 'Données réelles', AUCUNE: 'Aucune (règles fixes)', INCONNUE: 'Non communiquée',
};
