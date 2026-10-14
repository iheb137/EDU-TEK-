import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

export const ROUTES_PLATEFORME: Routes = [
  { path: 'etablissements', title: 'Établissements · Edu-Tek', canActivate: [roleGuard('SUPERADMIN')],
    loadComponent: () => import('./etablissements/etablissements').then((m) => m.Etablissements) },
  { path: 'supervision', title: 'Supervision technique · Edu-Tek', canActivate: [roleGuard('SUPERADMIN')],
    loadComponent: () => import('./supervision/supervision').then((m) => m.Supervision) },
  { path: 'modeles-ia', title: 'Modèles IA · Edu-Tek', canActivate: [roleGuard('SUPERADMIN')],
    loadComponent: () => import('./modeles-ia/modeles-ia').then((m) => m.ModelesIa) },
  { path: 'roles', title: 'Rôles et permissions · Edu-Tek', canActivate: [roleGuard('SUPERADMIN')],
    loadComponent: () => import('./roles/roles').then((m) => m.Roles) },
  { path: 'administrateurs', title: 'Administrateurs · Edu-Tek', canActivate: [roleGuard('SUPERADMIN')],
    loadComponent: () => import('./administrateurs/administrateurs').then((m) => m.Administrateurs) },
];
