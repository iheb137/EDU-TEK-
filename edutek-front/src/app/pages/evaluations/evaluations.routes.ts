import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

const PEDAGOGIE = roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE', 'ENSEIGNANT');
const ADMINISTRATION = roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE');

export const ROUTES_EVALUATIONS: Routes = [
  { path: 'evaluations', title: 'Évaluations · Edu-Tek', canActivate: [PEDAGOGIE],
    loadComponent: () => import('./liste/evaluations-liste').then((m) => m.EvaluationsListe) },
  { path: 'evaluations/:id', title: 'Saisie des notes · Edu-Tek', canActivate: [PEDAGOGIE],
    loadComponent: () => import('./detail/evaluation-detail').then((m) => m.EvaluationDetail) },
  { path: 'seances', title: 'Séances · Edu-Tek', canActivate: [PEDAGOGIE],
    loadComponent: () => import('./seances/seances-liste').then((m) => m.SeancesListe) },
  { path: 'seances/:id', title: 'Feuille de présence · Edu-Tek', canActivate: [PEDAGOGIE],
    loadComponent: () => import('./seances/feuille-presence').then((m) => m.FeuillePresence) },
  { path: 'resultats', title: 'Résultats · Edu-Tek', canActivate: [ADMINISTRATION],
    loadComponent: () => import('./resultats/resultats').then((m) => m.Resultats) },
  { path: 'indicateurs', title: 'Indicateurs académiques · Edu-Tek', canActivate: [ADMINISTRATION],
    loadComponent: () => import('./indicateurs/indicateurs').then((m) => m.Indicateurs) },
];
