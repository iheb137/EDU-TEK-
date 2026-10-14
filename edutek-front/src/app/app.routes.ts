import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';
import { Type, inject } from '@angular/core';
import { Auth } from './core/auth';
import { rolePrincipal } from './core/menu';
import { ROUTES_ETUDIANT } from './pages/etudiant/etudiant.routes';
import { ROUTES_PLATEFORME } from './pages/plateforme/plateforme.routes';
import { ROUTES_COMMUNICATION } from './pages/communication/communication.routes';
import { ROUTES_REFERENTIEL } from './pages/referentiel/referentiel.routes';
import { ROUTES_IA } from './pages/ia/ia.routes';
import { ROUTES_SUPPORT } from './pages/support/support.routes';
import { ROUTES_EVALUATIONS } from './pages/evaluations/evaluations.routes';
import { ROUTES_ENSEIGNANT } from './pages/enseignant/enseignant.routes';

const ACCUEILS: [string, () => Promise<Type<unknown>>][] = [
  ['SUPERADMIN', () => import('./pages/administration/accueil-admin').then((m) => m.AccueilAdmin)],
  ['ADMIN_SUPPORT', () => import('./pages/support/accueil/accueil-support').then((m) => m.AccueilSupport)],
  ['ADMIN_COMMUNICATION', () => import('./pages/communication/actualites/actualites').then((m) => m.Actualites)],
  ['ENSEIGNANT', () => import('./pages/enseignant/accueil/accueil-enseignant').then((m) => m.AccueilEnseignant)],
  ['ADMIN_FINANCIER', () => import('./pages/enseignant/finance/accueil-financier').then((m) => m.AccueilFinancier)],
  ['ETUDIANT', () => import('./pages/etudiant/accueil/accueil-etudiant').then((m) => m.AccueilEtudiant)],
];

const bientot = () => import('./pages/bientot/bientot').then((m) => m.Bientot);

export const routes: Routes = [
  { path: 'connexion', title: 'Connexion · Edu-Tek', loadComponent: () => import('./pages/connexion/connexion').then((m) => m.Connexion) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      // Accueil propre à chaque profil : canMatch est réévalué à chaque navigation
      // (un loadComponent seul serait mémorisé et resservirait l'accueil du compte précédent).
      ...ACCUEILS.map(([role, charger]) => ({
        path: 'tableau-de-bord', title: 'Tableau de bord · Edu-Tek',
        canMatch: [() => rolePrincipal(inject(Auth).roles()) === role],
        loadComponent: charger,
      })),
      { path: 'tableau-de-bord', title: 'Tableau de bord · Edu-Tek', loadComponent: () => import('./pages/tableau-de-bord/tableau-de-bord').then((m) => m.TableauDeBord) },
      { path: 'pedagogie', title: 'Vue pédagogique · Edu-Tek', canActivate: [roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE')], loadComponent: () => import('./pages/tableau-de-bord/tableau-de-bord').then((m) => m.TableauDeBord) },
      { path: 'utilisateurs', title: 'Utilisateurs · Edu-Tek', canActivate: [roleGuard('SUPERADMIN')], loadComponent: () => import('./pages/utilisateurs/utilisateurs').then((m) => m.Utilisateurs) },
      { path: 'audit', title: 'Audit · Edu-Tek', canActivate: [roleGuard('SUPERADMIN')], loadComponent: () => import('./pages/audit/audit').then((m) => m.Audit) },
      { path: 'guide', title: 'Guide d\'utilisation · Edu-Tek', data: { sujet: 'guide' }, loadComponent: () => import('./pages/pages-info/pages-info').then((m) => m.PagesInfo) },
      { path: 'confidentialite', title: 'Confidentialité · Edu-Tek', data: { sujet: 'confidentialite' }, loadComponent: () => import('./pages/pages-info/pages-info').then((m) => m.PagesInfo) },
      { path: 'contact', title: 'Contact · Edu-Tek', data: { sujet: 'contact' }, loadComponent: () => import('./pages/pages-info/pages-info').then((m) => m.PagesInfo) },
      ...ROUTES_ETUDIANT,
      ...ROUTES_PLATEFORME,
      ...ROUTES_COMMUNICATION,
      ...ROUTES_REFERENTIEL,
      ...ROUTES_IA,
      ...ROUTES_SUPPORT,
      ...ROUTES_EVALUATIONS,
      ...ROUTES_ENSEIGNANT,
      { path: '**', title: 'Page introuvable · Edu-Tek', data: { titre: 'Page introuvable' }, loadComponent: bientot },
    ],
  },
];
