import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStoreService } from '../state/auth-store.service';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStoreService);
  const router = inject(Router);

  if (authStore.isAuthenticated()) return true;

  router.navigate(['/login']);
  return false;
};