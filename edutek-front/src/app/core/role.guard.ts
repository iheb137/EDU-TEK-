import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

/** Autorise l'accès si le compte a au moins un des rôles demandés, sinon renvoie au tableau de bord. */
export const roleGuard = (...roles: string[]): CanActivateFn => () => {
  const auth = inject(Auth);
  return auth.a(...roles) ? true : inject(Router).parseUrl('/tableau-de-bord');
};
