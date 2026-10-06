// AuthStoreService - session state on top of the real backend.
// Tokens live in TokenStore (localStorage) so the HTTP interceptor can attach them;
// the profile comes from GET /auth/me.

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthService } from '../api/auth.service';
import { TokenStore } from '../api/token.store';
import { ToastService } from '../toast/toast.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import type { AuthUser } from '../../shared/models/auth.models';

const PROFILE_KEY = 'collabai.profile';

@Injectable({ providedIn: 'root' })
export class AuthStoreService {
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly workspace = inject(WorkspaceContextService);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly accessToken = signal<string | null>(this.tokens.get());
  readonly isLoading = signal(false);
  readonly isRestoring = signal(false);
  readonly authError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => Boolean(this.accessToken()));

  private restoreSessionRequest: Observable<boolean> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'collabai.accessToken') {
          if (!event.newValue) {
            this.clearSession();
            void this.router.navigate(['/login']);
          } else {
            this.accessToken.set(event.newValue);
          }
        }
      });
    }
  }

  login(rawEmail: string, password: string): void {
    const email = rawEmail.trim().toLowerCase();
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.login({ email, password }).subscribe({
      next: ({ accessToken }) => {
        this.setToken(accessToken);
        this.auth.me().subscribe({
          next: ({ user }) => {
            this.currentUser.set(user);
            this.cacheProfile(user);
            void this.workspace.onSignedIn(user._id);
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
      },
      error: (err) => {
        this.isLoading.set(false);
        this.authError.set(this.errorMessage(err));
      },
    });
  }

  register(firstName: string, lastName: string, rawEmail: string, password: string): void {
    const email = rawEmail.trim().toLowerCase();
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.register({ firstName, lastName, email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toast.show(
          'Account created - check your email for a 6-digit verification code',
          'success',
        );
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
      tap(({ user }) => {
        this.currentUser.set(user);
        this.cacheProfile(user);
        void this.workspace.onSignedIn(user._id);
      }),
      map(() => true),
      catchError((err: { status?: number }) => {
        // Offline / server unreachable: keep the session and use the last known profile so
        // the app still opens with cached data. Only a real rejection (401/403) signs out.
        const unreachable = err?.status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine);
        const cached = unreachable ? this.cachedProfile() : null;
        if (cached) {
          this.currentUser.set(cached);
          void this.workspace.onSignedIn(cached._id);
          return of(true);
        }
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
  }

  updateProfile(fields: { name?: string; avatarUrl?: string | null }): Observable<AuthUser> {
    return this.auth.updateProfile(fields).pipe(
      map(({ user }) => {
        this.currentUser.set(user);
        this.cacheProfile(user);
        return user;
      }),
    );
  }

  clearAuthError(): void {
    this.authError.set(null);
  }

  private finishLogout(): void {
    this.clearSession();
    // Explicit logout (e.g. on a shared computer): drop this user's offline data too.
    void this.workspace.signOut();
    this.toast.show('Logged out', 'info');
    void this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    this.tokens.setToken(token);
    this.accessToken.set(token);
  }

  clearSession(): void {
    this.tokens.clear();
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* storage unavailable */
    }
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.workspace.selectProject('');
  }

  /** Last known profile, so the app can open offline with the user's name and id. */
  private cacheProfile(user: AuthUser): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
    } catch {
      /* storage unavailable — offline start just won't have a profile */
    }
  }

  private cachedProfile(): AuthUser | null {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private errorMessage(err: unknown): string {
    const anyErr = err as { error?: { error?: { message?: string } } };
    return anyErr?.error?.error?.message ?? 'Something went wrong. Please try again.';
  }
}
