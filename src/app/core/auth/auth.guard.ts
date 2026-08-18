import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthStoreService } from '../state/auth-store.service';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStoreService);
  const router = inject(Router);

  if (authStore.isAuthenticated()) return true;
  if (!authStore.accessToken()) return router.createUrlTree(['/login']);

  return authStore.restoreSession().pipe(
    map((isRestored) => (isRestored ? true : router.createUrlTree(['/login']))),
  );
};
