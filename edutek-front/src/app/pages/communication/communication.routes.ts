import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

/** Module Communication : messagerie, notifications, annuaire, actualités, diffusions, profil. */
export const ROUTES_COMMUNICATION: Routes = [
  { path: 'messagerie', title: 'Messagerie · Edu-Tek',
    loadComponent: () => import('./messagerie/messagerie').then((m) => m.Messagerie) },
  { path: 'notifications', title: 'Notifications · Edu-Tek',
    loadComponent: () => import('./notifications/notifications').then((m) => m.Notifications) },
  { path: 'annuaire', title: 'Annuaire · Edu-Tek',
    loadComponent: () => import('./annuaire/annuaire').then((m) => m.Annuaire) },
  { path: 'actualites', title: 'Actualités · Edu-Tek',
    loadComponent: () => import('./actualites/actualites').then((m) => m.Actualites) },
  { path: 'diffusions', title: 'Diffusions · Edu-Tek', canActivate: [roleGuard('SUPERADMIN', 'ADMIN_COMMUNICATION')],
    loadComponent: () => import('./diffusions/diffusions').then((m) => m.Diffusions) },
  { path: 'profil', title: 'Mon profil · Edu-Tek',
    loadComponent: () => import('./profil/profil').then((m) => m.Profil) },
];
