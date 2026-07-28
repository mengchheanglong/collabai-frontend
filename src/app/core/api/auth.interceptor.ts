// src/app/core/api/auth.interceptor.ts
//
// Functional HTTP interceptor. For calls to the API base it:
//   - sends credentials (so the httpOnly refresh cookie flows), and
//   - attaches `Authorization: Bearer <token>` when a token is present.
// Auth UI is skipped for now, so requests simply go out unauthenticated until a token
// exists in the TokenStore (guarded endpoints will 401 until then — expected).

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TokenStore } from './token.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const token = inject(TokenStore).get();
  return next(
    req.clone({
      withCredentials: true,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
};
