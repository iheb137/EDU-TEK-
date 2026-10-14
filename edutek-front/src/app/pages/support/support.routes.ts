import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

/** Module Support : justificatifs, demandes de documents, stages et calendrier académique. */
export const ROUTES_SUPPORT: Routes = [
  { path: 'accueil-support', title: 'Tableau de bord support · Edu-Tek', canActivate: [roleGuard('ADMIN_SUPPORT', 'SUPERADMIN')],
    loadComponent: () => import('./accueil/accueil-support').then((m) => m.AccueilSupport) },
  { path: 'justificatifs', title: 'Justificatifs d\'absence · Edu-Tek', canActivate: [roleGuard('ADMIN_SUPPORT', 'SUPERADMIN')],
    loadComponent: () => import('./justificatifs/justificatifs').then((m) => m.Justificatifs) },
  { path: 'demandes-documents', title: 'Demandes de documents · Edu-Tek', canActivate: [roleGuard('ADMIN_SUPPORT', 'SUPERADMIN')],
    loadComponent: () => import('./demandes-documents/demandes-documents').then((m) => m.DemandesDocuments) },
  { path: 'stages', title: 'Stages · Edu-Tek', canActivate: [roleGuard('ADMIN_COMMUNICATION', 'SUPERADMIN', 'ADMIN_PEDAGOGIQUE')],
    loadComponent: () => import('./stages/stages').then((m) => m.Stages) },
  { path: 'calendrier', title: 'Calendrier · Edu-Tek',
    loadComponent: () => import('./calendrier/calendrier').then((m) => m.Calendrier) },
];
