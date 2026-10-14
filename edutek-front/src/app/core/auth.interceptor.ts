import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Auth } from './auth';

/** Ajoute le jeton aux appels API (sauf connexion) et renvoie vers la connexion si le jeton est refusé. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const prive = req.url.startsWith('/api') && !req.url.includes('/auth/');
  const token = auth.token();
  const requete = prive && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(requete).pipe(
    catchError((e: unknown) => {
      if (prive && e instanceof HttpErrorResponse && e.status === 401) { auth.deconnecter(); }
      return throwError(() => e);
    }),
  );
};
