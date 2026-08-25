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

  login(email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.login({ email, password }).subscribe({
      next: ({ accessToken }) => {
        this.setToken(accessToken);
        this.auth.me().subscribe({
          next: ({ user }) => {
            this.currentUser.set(user);
            this.workspace.reloadProjects();
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

  register(firstName: string, lastName: string, email: string, password: string): void {
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
        this.workspace.reloadProjects();
      }),
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
  }

  clearAuthError(): void {
    this.authError.set(null);
  }

  private finishLogout(): void {
    this.clearSession();
    this.toast.show('Logged out', 'info');
    void this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    this.tokens.setToken(token);
    this.accessToken.set(token);
  }

  clearSession(): void {
    this.tokens.clear();
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.workspace.selectProject('');
  }

  private errorMessage(err: unknown): string {
    const anyErr = err as { error?: { error?: { message?: string } } };
    return anyErr?.error?.error?.message ?? 'Something went wrong. Please try again.';
  }
}
