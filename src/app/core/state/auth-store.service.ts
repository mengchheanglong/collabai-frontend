<<<<<<< HEAD
// src/app/core/state/auth-store.service.ts
//
// Auth session state. Orchestrates the backend flow:
//   - login -> POST /auth/login (accessToken) -> GET /auth/me (user) -> dashboard
//   - register -> POST /auth/register -> /verify-email (the account must verify first)
//   - restoreSession -> GET /auth/me using the stored token on app start.

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
=======
// AuthStoreService — session state on top of the real backend.
// Tokens live in TokenStore (localStorage) so the HTTP interceptor can attach them;
// the profile comes from GET /auth/me.

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
import { AuthService } from '../api/auth.service';
import { TokenStore } from '../api/token.store';
import { ToastService } from '../toast/toast.service';
import type { AuthUser } from '../../shared/models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthStoreService {
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly accessToken = signal<string | null>(this.tokens.get());
  readonly isLoading = signal(false);
  readonly isRestoring = signal(false);
  readonly authError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => !!this.accessToken());

  private restoreSessionRequest: Observable<boolean> | null = null;

  login(email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.login({ email, password }).subscribe({
      next: ({ accessToken }) => {
<<<<<<< HEAD
        this.setToken(accessToken);
        // Fetch the user (backend login returns only the token).
        this.auth.me().subscribe({
          next: ({ user }) => {
            this.currentUser.set(user);
            this.isLoading.set(false);
            this.toast.show(`Welcome back, ${user.name}`, 'success');
            void this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.isLoading.set(false);
            this.clearSession();
            this.authError.set('Could not load your account. Please try again.');
          },
        });
=======
        this.tokens.setToken(accessToken);
        this.accessToken.set(accessToken);
        this.isLoading.set(false);
        void this.router.navigate(['/dashboard']);
        this.loadCurrentUser({ welcome: true });
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
      },
      error: (err) => {
        this.isLoading.set(false);
        this.authError.set(this.errorMessage(err));
      },
    });
  }

  register(firstName: string, lastName: string, email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.register({ firstName, lastName, email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
<<<<<<< HEAD
        this.toast.show('Check your email for a verification code', 'success');
=======
        this.toast.show(
          'Account created — check your email for a 6-digit verification code',
          'success',
        );
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
        void this.router.navigate(['/verify-email'], { queryParams: { email } });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.authError.set(this.errorMessage(err));
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
<<<<<<< HEAD
      next: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  restoreSession(): Observable<boolean> {
    const token = this.accessToken();
    if (!token) {
      this.currentUser.set(null);
      return of(false);
    }

    if (this.currentUser()) return of(true);
    if (this.restoreSessionRequest) return this.restoreSessionRequest;

    this.isRestoring.set(true);
    this.restoreSessionRequest = this.auth.me().pipe(
      tap(({ user }) => this.currentUser.set(user)),
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
      finalize(() => {
        this.isRestoring.set(false);
        this.restoreSessionRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.restoreSessionRequest;
=======
      next: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

  /** Hydrate the profile on app start if a token already exists. */
  restoreSession(): void {
    if (!this.accessToken()) return;
    this.loadCurrentUser({ welcome: false });
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
  }

  clearAuthError(): void {
    this.authError.set(null);
  }

<<<<<<< HEAD
  private finishLogout(): void {
    this.clearSession();
    this.toast.show('Logged out', 'info');
    void this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    this.accessToken.set(token);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
=======
  private loadCurrentUser(options: { welcome: boolean }): void {
    this.auth.me().subscribe({
      next: ({ user }) => {
        this.currentUser.set(user);
        this.isLoading.set(false);
        if (options.welcome) this.toast.show(`Welcome back, ${user.name}`, 'success');
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          // Invalid/expired token — the session is gone, send the user to login.
          this.clearSession();
          void this.router.navigate(['/login']);
        }
        // 429 / 5xx / network — keep the session; the profile just didn't hydrate.
      },
    });
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
  }

  private clearSession(): void {
    this.tokens.clear();
    this.accessToken.set(null);
    this.currentUser.set(null);
  }
<<<<<<< HEAD
=======

  private errorMessage(err: unknown): string {
    const anyErr = err as { error?: { error?: { message?: string } } };
    return anyErr?.error?.error?.message ?? 'Something went wrong. Please try again.';
  }
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
}
