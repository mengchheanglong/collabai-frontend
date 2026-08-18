// src/app/core/api/auth.interceptor.ts
//
// Functional HTTP interceptor. For calls to the API base it:
//   - sends credentials (so the httpOnly refresh cookie flows),
//   - attaches `Authorization: Bearer <token>` when a token is present,
//   - automatically refreshes tokens on 401 for protected endpoints and retries failed requests,
//   - prevents refresh loops and cleanly redirects to login on session expiry or logout.

import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, finalize, switchMap, take, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStoreService } from '../state/auth-store.service';
import { TokenStore } from './token.store';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const tokenStore = inject(TokenStore);
  const authStore = inject(AuthStoreService);
  const router = inject(Router);
  const httpBackend = inject(HttpBackend);

  const isPublicAuthEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/verify-email') ||
    req.url.includes('/auth/resend-email-verification') ||
    req.url.includes('/auth/request-password-reset') ||
    req.url.includes('/auth/verify-password-reset') ||
    req.url.includes('/auth/reset-password') ||
    req.url.includes('/auth/resend-password-reset-verification');

  const isRefreshEndpoint = req.url.includes('/auth/refresh-token');
  const isLogoutEndpoint = req.url.includes('/auth/logout');

  const token = tokenStore.get();
  const authReq = req.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Public auth endpoints (e.g. wrong password on /auth/login) should pass error to the form
        if (isPublicAuthEndpoint) {
          return throwError(() => error);
        }

        // If the refresh endpoint itself failed with 401, or logout failed, clear session and redirect
        if (isRefreshEndpoint || isLogoutEndpoint) {
          tokenStore.clear();
          authStore.clearSession();
          void router.navigate(['/login']);
          return throwError(() => error);
        }

        // If no token exists at all, redirect to login
        if (!token) {
          tokenStore.clear();
          authStore.clearSession();
          void router.navigate(['/login']);
          return throwError(() => error);
        }

        // Protected endpoint received 401 with an existing token -> attempt token refresh
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          const refreshClient = new HttpClient(httpBackend);
          return refreshClient
            .post<{ success?: boolean; data?: { accessToken: string }; accessToken?: string }>(
              `${environment.apiBaseUrl}/auth/refresh-token`,
              {},
              { withCredentials: true },
            )
            .pipe(
              switchMap((res) => {
                const newAccessToken = res.data?.accessToken || res.accessToken;
                if (!newAccessToken) {
                  tokenStore.clear();
                  authStore.clearSession();
                  refreshTokenSubject.next(null);
                  void router.navigate(['/login']);
                  return throwError(() => error);
                }
                tokenStore.setToken(newAccessToken);
                authStore.accessToken.set(newAccessToken);
                refreshTokenSubject.next(newAccessToken);
                return next(
                  req.clone({
                    withCredentials: true,
                    setHeaders: { Authorization: `Bearer ${newAccessToken}` },
                  }),
                );
              }),
              catchError((refreshErr) => {
                tokenStore.clear();
                authStore.clearSession();
                refreshTokenSubject.next(null);
                void router.navigate(['/login']);
                return throwError(() => refreshErr);
              }),
              finalize(() => {
                isRefreshing = false;
              }),
            );
        } else {
          // If a refresh is already in progress, wait for the new token and retry
          return refreshTokenSubject.pipe(
            filter((newToken): newToken is string => newToken !== null),
            take(1),
            switchMap((newToken) =>
              next(
                req.clone({
                  withCredentials: true,
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                }),
              ),
            ),
          );
        }
      }
      return throwError(() => error);
    }),
  );
};
