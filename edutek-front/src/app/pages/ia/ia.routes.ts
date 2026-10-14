import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

/** Module IA : alertes, accompagnement, prédictions et paramètres de risque (SuperAdmin, admin pédagogique). */
export const ROUTES_IA: Routes = [
  { path: 'alertes', title: 'Alertes · Edu-Tek', canActivate: [roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE')],
    loadComponent: () => import('./alertes/alertes').then((m) => m.Alertes) },
  { path: 'alertes/:id', title: 'Alerte · Edu-Tek', canActivate: [roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE')],
    loadComponent: () => import('./alerte-detail/alerte-detail').then((m) => m.AlerteDetail) },
  { path: 'accompagnement', title: 'Accompagnement · Edu-Tek', canActivate: [roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE')],
    loadComponent: () => import('./accompagnement/accompagnement').then((m) => m.Accompagnement) },
  { path: 'predictions', title: 'Prédictions · Edu-Tek', canActivate: [roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE')],
    loadComponent: () => import('./predictions/predictions').then((m) => m.Predictions) },
  { path: 'parametres-ia', title: 'Paramètres de risque · Edu-Tek', canActivate: [roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE')],
    loadComponent: () => import('./parametres/parametres-ia').then((m) => m.ParametresIa) },
];
