// src/app/core/state/auth-store.service.ts
//
// Auth session state. Orchestrates the backend flow:
//   - login -> POST /auth/login (accessToken) -> GET /auth/me (user) -> dashboard
//   - register -> POST /auth/register -> /verify-email (the account must verify first)
//   - restoreSession -> GET /auth/me using the stored token on app start.

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../api/auth.service';
import { ToastService } from '../toast/toast.service';
import type { AuthUser } from '../../shared/models/auth.models';

const TOKEN_STORAGE_KEY = 'collabai_access_token';

@Injectable({ providedIn: 'root' })
export class AuthStoreService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly accessToken = signal<string | null>(sessionStorage.getItem(TOKEN_STORAGE_KEY));
  readonly isLoading = signal(false);
  readonly authError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => !!this.accessToken() && !!this.currentUser());

  login(email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.login({ email, password }).subscribe({
      next: ({ accessToken }) => {
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
      },
      error: (err) => {
        this.isLoading.set(false);
        this.authError.set(err?.error?.message ?? 'Invalid email or password');
      },
    });
  }

  register(firstName: string, lastName: string, email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.register({ firstName, lastName, email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toast.show('Check your email for a verification code', 'success');
        void this.router.navigate(['/verify-email'], { queryParams: { email } });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.authError.set(err?.error?.message ?? 'Could not create account');
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  restoreSession(): void {
    const token = this.accessToken();
    if (!token) return;
    this.auth.me().subscribe({
      next: ({ user }) => this.currentUser.set(user),
      error: () => this.clearSession(),
    });
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
    this.accessToken.set(token);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}
