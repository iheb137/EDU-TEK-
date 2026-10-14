export interface Semestre { id: number; nom: string; dateDebut?: string; dateFin?: string; formationId: number; }
export interface Repartition { faible: number; moyen: number; eleve: number; }
export interface ClasseResume { classeId: number; classeNom: string; nbEtudiantsAnalyses: number; nbEleve: number; nbMoyen: number; probabiliteMoyenne: number; }
export interface TableauDeBordDto {
  semestreId: number; classeId?: number; nbEtudiantsAnalyses: number; repartition: Repartition; probabiliteMoyenne: number;
  alertes: { ouvertes: number; enCours: number; traitees: number; classees: number };
  actions: { planifiees: number; enCours: number; terminees: number; annulees: number };
  facteursPrincipaux: { nom: string; occurrences: number }[];
  parClasse: ClasseResume[];
  derniereAnalyse?: string;
}
export interface Alerte {
  id: number; predictionId: number; etudiantId: number; etudiantNom: string; etudiantMatricule: string;
  semestreId: number; niveau: string; score: number; statut: string; dateDetection: string; nbActions: number;
}

export interface Page<T> { contenu: T[]; page: number; taille: number; total: number; pages: number; }
export interface UtilisateurAdmin {
  id: number; nom: string; prenom: string; email: string; telephone?: string; actif: boolean;
  mdpTemporaire: boolean; type?: string; roles: string[]; dateCreation?: string;
}
export interface Role { id: number; nom: string; systeme: boolean; permissions: unknown[]; }
export interface Audit { id: number; horodatage: string; acteurEmail: string; action: string; entite: string; entiteId?: number; details?: string; adresseIp?: string; }
export interface ImportResultat {
  simulation: boolean; lignesLues: number; lignesValides: number; comptesCrees: number;
  erreurs: { ligne: number; message: string }[];
  comptes: { email: string; type: string; motDePasseTemporaire: string }[];
}
export interface MotDePasseTemporaire { email: string; motDePasseTemporaire: string; message?: string; }

export const LIBELLE_ROLE: Record<string, string> = {
  SUPERADMIN: 'Super administrateur', ADMIN_PEDAGOGIQUE: 'Admin pédagogique', ADMIN_COMMUNICATION: 'Admin communication',
  ADMIN_SUPPORT: 'Admin support', ADMIN_FINANCIER: 'Admin financier', ENSEIGNANT: 'Enseignant', ETUDIANT: 'Étudiant',
};
