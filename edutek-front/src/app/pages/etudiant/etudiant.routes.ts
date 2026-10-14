import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

const ETUDIANT = [roleGuard('ETUDIANT')];

/** Espace étudiant (rôle ETUDIANT uniquement). */
export const ROUTES_ETUDIANT: Routes = [
  { path: 'accueil-etudiant', title: 'Accueil · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./accueil/accueil-etudiant').then((m) => m.AccueilEtudiant) },
  { path: 'mes-cours', title: 'Mes cours · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./cours/mes-cours').then((m) => m.MesCours) },
  { path: 'mes-notes', title: 'Mes notes · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./notes/mes-notes').then((m) => m.MesNotes) },
  { path: 'mon-bulletin', title: 'Mon bulletin · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./bulletin/mon-bulletin').then((m) => m.MonBulletin) },
  { path: 'mes-presences', title: 'Mes présences · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./presences/mes-presences').then((m) => m.MesPresences) },
  { path: 'mes-justificatifs', title: 'Mes justificatifs · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./justificatifs/mes-justificatifs').then((m) => m.MesJustificatifs) },
  { path: 'mes-recommandations', title: 'Mes recommandations · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./recommandations/mes-recommandations').then((m) => m.MesRecommandations) },
  { path: 'mes-stages', title: 'Mes stages · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./stages/mes-stages').then((m) => m.MesStages) },
  { path: 'mes-demandes', title: 'Mes demandes de documents · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./demandes/mes-demandes').then((m) => m.MesDemandes) },
  { path: 'mes-classes-virtuelles', title: 'Mes classes virtuelles · Edu-Tek', canActivate: ETUDIANT,
    loadComponent: () => import('./classes-virtuelles/mes-classes-virtuelles').then((m) => m.MesClassesVirtuelles) },
];
