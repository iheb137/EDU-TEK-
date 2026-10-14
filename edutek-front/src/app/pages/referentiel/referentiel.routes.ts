import { Routes } from '@angular/router';
import { roleGuard } from '../../core/role.guard';

/** Référentiel pédagogique : réservé au SuperAdmin et à l'administration pédagogique. */
const ADMIN = roleGuard('SUPERADMIN', 'ADMIN_PEDAGOGIQUE');

export const ROUTES_REFERENTIEL: Routes = [
  { path: 'formations', title: 'Formations · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./formations/formations').then((m) => m.Formations) },
  { path: 'formations/:id', title: 'Formation · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./formations/formation-detail').then((m) => m.FormationDetail) },
  { path: 'semestres', title: 'Semestres · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./semestres/semestres').then((m) => m.Semestres) },
  { path: 'matieres', title: 'Matières · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./matieres/matieres').then((m) => m.Matieres) },
  { path: 'classes', title: 'Classes · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./classes/classes').then((m) => m.Classes) },
  { path: 'classes/:id', title: 'Classe · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./classes/classe-detail').then((m) => m.ClasseDetail) },
  { path: 'etudiants', title: 'Étudiants · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./etudiants/etudiants').then((m) => m.Etudiants) },
  { path: 'etudiants/:id', title: 'Fiche étudiant · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./etudiants/etudiant-fiche').then((m) => m.EtudiantFiche) },
  { path: 'enseignants', title: 'Enseignants · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./enseignants/enseignants').then((m) => m.Enseignants) },
  { path: 'inscriptions', title: 'Inscriptions · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./inscriptions/inscriptions').then((m) => m.Inscriptions) },
  { path: 'enseignements', title: 'Enseignements · Edu-Tek', canActivate: [ADMIN],
    loadComponent: () => import('./enseignements/enseignements').then((m) => m.Enseignements) },
];
