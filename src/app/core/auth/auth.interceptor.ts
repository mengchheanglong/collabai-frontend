// src/app/core/auth/auth.interceptor.ts
//
// For API calls: sends credentials (so the httpOnly registration/reset/refresh cookies
// flow) and attaches the bearer access token when one is stored.

import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthStoreService } from '../state/auth-store.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = req.url.startsWith(environment.apiBaseUrl);
  if (!isApi) return next(req);

  const token = inject(AuthStoreService).accessToken();
  return next(
    req.clone({
      withCredentials: true,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
};
