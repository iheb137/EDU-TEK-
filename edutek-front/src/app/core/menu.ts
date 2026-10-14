/** Menus de navigation par rôle. Une entrée a soit une route, soit des enfants (menu déroulant). */
export interface EntreeMenu { libelle: string; icone: string; route?: string; enfants?: EntreeMenu[]; badge?: 'alertes'; }

const ACCUEIL: EntreeMenu = { libelle: 'Tableau de bord', route: '/tableau-de-bord', icone: 'home' };
const ACTUALITES: EntreeMenu = { libelle: 'Actualités', route: '/actualites', icone: 'newspaper' };
const CALENDRIER: EntreeMenu = { libelle: 'Calendrier', route: '/calendrier', icone: 'calendar' };

const SCOLARITE: EntreeMenu = {
  libelle: 'Scolarité', icone: 'school', enfants: [
    { libelle: 'Formations', route: '/formations', icone: 'library' },
    { libelle: 'Semestres', route: '/semestres', icone: 'calendar' },
    { libelle: 'Matières', route: '/matieres', icone: 'book' },
    { libelle: 'Classes', route: '/classes', icone: 'people-circle' },
    { libelle: 'Enseignements', route: '/enseignements', icone: 'layers' },
    { libelle: 'Supports de cours', route: '/supports-cours', icone: 'folder-open' },
    { libelle: 'Inscriptions', route: '/inscriptions', icone: 'id-card' },
  ],
};
const PERSONNES: EntreeMenu = {
  libelle: 'Personnes', icone: 'people', enfants: [
    { libelle: 'Étudiants', route: '/etudiants', icone: 'people' },
    { libelle: 'Enseignants', route: '/enseignants', icone: 'person' },
    { libelle: 'Stages', route: '/stages', icone: 'briefcase' },
  ],
};
const EVALUATION: EntreeMenu = {
  libelle: 'Évaluation', icone: 'document-text', enfants: [
    { libelle: 'Évaluations et notes', route: '/evaluations', icone: 'document-text' },
    { libelle: 'Séances et présences', route: '/seances', icone: 'checkbox' },
    { libelle: 'Résultats', route: '/resultats', icone: 'ribbon' },
    { libelle: 'Indicateurs', route: '/indicateurs', icone: 'analytics' },
  ],
};
const IA: EntreeMenu = {
  libelle: 'Alertes IA', icone: 'warning', badge: 'alertes', enfants: [
    { libelle: 'Alertes', route: '/alertes', icone: 'warning' },
    { libelle: 'Accompagnement', route: '/accompagnement', icone: 'heart' },
    { libelle: 'Prédictions', route: '/predictions', icone: 'trending-up' },
    { libelle: 'Paramètres du risque', route: '/parametres-ia', icone: 'options' },
  ],
};

const MENUS: Record<string, EntreeMenu[]> = {
  SUPERADMIN: [
    ACCUEIL,
    { libelle: 'Comptes', icone: 'people', enfants: [
      { libelle: 'Utilisateurs', route: '/utilisateurs', icone: 'people' },
      { libelle: 'Administrateurs', route: '/administrateurs', icone: 'shield-checkmark' },
      { libelle: 'Rôles et permissions', route: '/roles', icone: 'key' },
    ] },
    { libelle: 'Établissements', route: '/etablissements', icone: 'business' },
    { libelle: 'Pédagogie', icone: 'school', enfants: [
      { libelle: 'Vue pédagogique', route: '/pedagogie', icone: 'stats-chart' },
      ...SCOLARITE.enfants!, ...PERSONNES.enfants!.slice(0, 2),
      { libelle: 'Résultats', route: '/resultats', icone: 'ribbon' },
    ] },
    { libelle: 'IA', icone: 'hardware-chip', enfants: [
      { libelle: 'Modèles IA', route: '/modeles-ia', icone: 'hardware-chip' },
      ...IA.enfants!,
    ] },
    { libelle: 'Services', icone: 'megaphone', enfants: [
      { libelle: 'Actualités', route: '/actualites', icone: 'newspaper' },
      { libelle: 'Diffusions', route: '/diffusions', icone: 'megaphone' },
      { libelle: 'Justificatifs', route: '/justificatifs', icone: 'medkit' },
      { libelle: 'Demandes de documents', route: '/demandes-documents', icone: 'document-attach' },
      { libelle: 'Stages', route: '/stages', icone: 'briefcase' },
      { libelle: 'Calendrier', route: '/calendrier', icone: 'calendar' },
    ] },
    { libelle: 'Technique', icone: 'pulse', enfants: [
      { libelle: 'Supervision', route: '/supervision', icone: 'pulse' },
      { libelle: 'Journal d\'audit', route: '/audit', icone: 'shield-checkmark' },
    ] },
  ],
  ADMIN_PEDAGOGIQUE: [ACCUEIL, SCOLARITE, PERSONNES, EVALUATION, IA, CALENDRIER],
  ENSEIGNANT: [
    { libelle: 'Accueil', route: '/tableau-de-bord', icone: 'home' },
    { libelle: 'Faire l\'appel', route: '/appel', icone: 'checkbox' },
    { libelle: 'Enseignement', icone: 'layers', enfants: [
      { libelle: 'Mes enseignements', route: '/mes-enseignements', icone: 'layers' },
      { libelle: 'Supports de cours', route: '/supports-cours', icone: 'folder-open' },
      { libelle: 'Évaluations et notes', route: '/evaluations', icone: 'document-text' },
      { libelle: 'Séances', route: '/seances', icone: 'calendar' },
    ] },
    { libelle: 'Classes virtuelles', route: '/classes-virtuelles', icone: 'videocam' },
    { libelle: 'Pointages', icone: 'time', enfants: [
      { libelle: 'Mes pointages', route: '/mes-pointages', icone: 'time' },
      { libelle: 'Mes paiements', route: '/mes-paiements', icone: 'wallet' },
    ] },
    CALENDRIER, ACTUALITES,
  ],
  ETUDIANT: [
    { libelle: 'Accueil', route: '/tableau-de-bord', icone: 'home' },
    { libelle: 'Scolarité', icone: 'ribbon', enfants: [
      { libelle: 'Mes cours', route: '/mes-cours', icone: 'folder-open' },
      { libelle: 'Mes notes', route: '/mes-notes', icone: 'document-text' },
      { libelle: 'Mon bulletin', route: '/mon-bulletin', icone: 'ribbon' },
      { libelle: 'Mes recommandations', route: '/mes-recommandations', icone: 'bulb' },
    ] },
    { libelle: 'Assiduité', icone: 'checkbox', enfants: [
      { libelle: 'Mes présences', route: '/mes-presences', icone: 'checkbox' },
      { libelle: 'Mes justificatifs', route: '/mes-justificatifs', icone: 'medkit' },
    ] },
    { libelle: 'Classes virtuelles', route: '/mes-classes-virtuelles', icone: 'videocam' },
    { libelle: 'Démarches', icone: 'folder-open', enfants: [
      { libelle: 'Mes stages', route: '/mes-stages', icone: 'briefcase' },
      { libelle: 'Mes demandes de documents', route: '/mes-demandes', icone: 'document-attach' },
    ] },
    CALENDRIER, ACTUALITES,
  ],
  ADMIN_COMMUNICATION: [
    { libelle: 'Accueil', route: '/tableau-de-bord', icone: 'home' },
    { libelle: 'Actualités', route: '/actualites', icone: 'newspaper' },
    { libelle: 'Diffusions', route: '/diffusions', icone: 'megaphone' },
    { libelle: 'Stages', route: '/stages', icone: 'briefcase' },
    { libelle: 'Annuaire', route: '/annuaire', icone: 'people' },
    CALENDRIER,
  ],
  ADMIN_SUPPORT: [
    { libelle: 'Accueil', route: '/tableau-de-bord', icone: 'home' },
    { libelle: 'Justificatifs', route: '/justificatifs', icone: 'medkit' },
    { libelle: 'Documents', route: '/demandes-documents', icone: 'document-attach' },
    { libelle: 'Annuaire', route: '/annuaire', icone: 'people' },
    CALENDRIER, ACTUALITES,
  ],
  ADMIN_FINANCIER: [
    { libelle: 'Accueil', route: '/tableau-de-bord', icone: 'home' },
    { libelle: 'Pointages', route: '/pointages', icone: 'time' },
    { libelle: 'Paiements', route: '/paiements', icone: 'wallet' },
    { libelle: 'Tarifs', route: '/tarifs', icone: 'cash' },
    CALENDRIER, ACTUALITES,
  ],
};

const PRIORITE = ['SUPERADMIN', 'ADMIN_PEDAGOGIQUE', 'ADMIN_FINANCIER', 'ADMIN_SUPPORT', 'ADMIN_COMMUNICATION', 'ENSEIGNANT', 'ETUDIANT'];

/** Rôle principal d'un compte (celui qui détermine le menu et l'accueil). */
export function rolePrincipal(roles: string[]): string {
  return PRIORITE.find((r) => roles.includes(r)) ?? '';
}

export function menuPour(roles: string[]): EntreeMenu[] {
  return MENUS[rolePrincipal(roles)] ?? [ACCUEIL, CALENDRIER, ACTUALITES];
}

export function estPedagogie(roles: string[]): boolean {
  return roles.includes('SUPERADMIN') || roles.includes('ADMIN_PEDAGOGIQUE');
}
