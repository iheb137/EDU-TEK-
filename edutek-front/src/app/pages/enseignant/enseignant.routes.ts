import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

const PEDAGOGIE_ENSEIGNANT = ['SUPERADMIN', 'ADMIN_PEDAGOGIQUE', 'ENSEIGNANT'];
const FINANCE = ['SUPERADMIN', 'ADMIN_FINANCIER'];

export const ROUTES_ENSEIGNANT: Routes = [
  { path: 'appel', title: 'Faire l\'appel · Edu-Tek', canActivate: [roleGuard('ENSEIGNANT', 'ADMIN_PEDAGOGIQUE', 'SUPERADMIN')],
    loadComponent: () => import('./appel/appel').then((m) => m.Appel) },
  { path: 'supports-cours', title: 'Supports de cours · Edu-Tek', canActivate: [roleGuard(...PEDAGOGIE_ENSEIGNANT)],
    loadComponent: () => import('./supports/supports-cours').then((m) => m.SupportsCours) },
  // Espace enseignant
  { path: 'accueil-enseignant', title: 'Espace enseignant · Edu-Tek', canActivate: [roleGuard('ENSEIGNANT')],
    loadComponent: () => import('./accueil/accueil-enseignant').then((m) => m.AccueilEnseignant) },
  { path: 'mes-enseignements', title: 'Mes enseignements · Edu-Tek', canActivate: [roleGuard(...PEDAGOGIE_ENSEIGNANT)],
    loadComponent: () => import('./mes-enseignements/mes-enseignements').then((m) => m.MesEnseignements) },
  { path: 'classes-virtuelles', title: 'Classes virtuelles · Edu-Tek', canActivate: [roleGuard(...PEDAGOGIE_ENSEIGNANT)],
    loadComponent: () => import('./classes-virtuelles/classes-virtuelles').then((m) => m.ClassesVirtuelles) },
  { path: 'mes-pointages', title: 'Mes pointages · Edu-Tek', canActivate: [roleGuard('ENSEIGNANT')],
    loadComponent: () => import('./mes-pointages/mes-pointages').then((m) => m.MesPointages) },
  { path: 'mes-paiements', title: 'Mes paiements · Edu-Tek', canActivate: [roleGuard('ENSEIGNANT')],
    loadComponent: () => import('./mes-paiements/mes-paiements').then((m) => m.MesPaiements) },

  // Finance (ADMIN_FINANCIER ; SUPERADMIN en consultation et génération)
  { path: 'accueil-financier', title: 'Finance · Edu-Tek', canActivate: [roleGuard(...FINANCE)],
    loadComponent: () => import('./finance/accueil-financier').then((m) => m.AccueilFinancier) },
  { path: 'tarifs', title: 'Tarifs horaires · Edu-Tek', canActivate: [roleGuard(...FINANCE)],
    loadComponent: () => import('./finance/tarifs/tarifs').then((m) => m.Tarifs) },
  { path: 'pointages', title: 'Pointages · Edu-Tek', canActivate: [roleGuard(...FINANCE)],
    loadComponent: () => import('./finance/pointages/pointages').then((m) => m.PointagesFinance) },
  { path: 'paiements', title: 'États de paiement · Edu-Tek', canActivate: [roleGuard(...FINANCE)],
    loadComponent: () => import('./finance/paiements/paiements').then((m) => m.Paiements) },
];
