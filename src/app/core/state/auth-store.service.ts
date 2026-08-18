// AuthStoreService — session state on top of the real backend.
// Tokens live in TokenStore (localStorage) so the HTTP interceptor can attach them;
// the profile comes from GET /auth/me.

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  readonly authError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => Boolean(this.accessToken()));

  login(email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.login({ email, password }).subscribe({
      next: ({ accessToken }) => {
        this.tokens.setToken(accessToken);
        this.accessToken.set(accessToken);
        this.isLoading.set(false);
        void this.router.navigate(['/dashboard']);
        this.loadCurrentUser({ welcome: true });
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
          'Account created — check your email for a 6-digit verification code',
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
      next: () => {
        this.clearSession();
        void this.router.navigate(['/login']);
      },
      error: () => {
        this.clearSession();
        void this.router.navigate(['/login']);
      },
    });
  }

  /** Hydrate the profile on app start if a token already exists. */
  restoreSession(): void {
    if (!this.accessToken()) return;
    this.loadCurrentUser({ welcome: false });
  }

  clearAuthError(): void {
    this.authError.set(null);
  }

  private loadCurrentUser(options: { welcome: boolean }): void {
    this.isLoading.set(true);
    this.auth.me().subscribe({
      next: ({ user }) => {
        this.currentUser.set(user);
        this.workspace.reloadProjects();
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
