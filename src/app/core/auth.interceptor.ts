import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TOKEN_KEY, USER_KEY } from './storage-keys';

/**
 * Attache le token Sanctum (Bearer) à chaque requête vers le backend, et
 * déconnecte automatiquement l'utilisateur si le backend répond 401
 * (token expiré/révoqué).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const router = inject(Router);

  const authReq = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
