import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../api/auth.service';
import { ToastService } from '../toast/toast.service';
import type { AuthUser } from '../../shared/models/auth.models';

const TOKEN_STORAGE_KEY = 'collabai_access_token';

@Injectable({ providedIn: 'root' })
export class AuthStoreService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly accessToken = signal<string | null>(sessionStorage.getItem(TOKEN_STORAGE_KEY));
  readonly isLoading = signal(false);
  readonly authError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => !!this.accessToken() && !!this.currentUser());

  login(email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.login({ email, password }).subscribe({
      next: ({ accessToken, user }) => {
        this.setSession(accessToken, user);
        this.isLoading.set(false);
        this.toast.show(`Welcome back, ${user.name}`, 'success');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.authError.set(err?.error?.message ?? 'Invalid email or password');
      },
    });
  }

  register(name: string, email: string, password: string): void {
    this.isLoading.set(true);
    this.authError.set(null);
    this.auth.register({ name, email, password }).subscribe({
      next: ({ accessToken, user }) => {
        this.setSession(accessToken, user);
        this.isLoading.set(false);
        this.toast.show('Account created', 'success');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.authError.set(err?.error?.message ?? 'Could not create account');
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.clearSession();
      this.toast.show('Logged out', 'info');
    });
  }

  restoreSession(): void {
    const token = this.accessToken();
    if (!token) return;
    this.auth.me(token).subscribe({
      next: ({ user }) => this.currentUser.set(user),
      error: () => this.clearSession(),
    });
  }

  clearAuthError(): void {
    this.authError.set(null);
  }

  private setSession(token: string, user: AuthUser): void {
    this.accessToken.set(token);
    this.currentUser.set(user);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}