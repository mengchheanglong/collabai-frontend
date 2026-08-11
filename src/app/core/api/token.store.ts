// src/app/core/api/token.store.ts
//
// Holds the bearer access token. Auth UI is intentionally not built yet (skipped), so for
// now the token is whatever has been placed in localStorage under `collabai.accessToken`
// (e.g. obtained via Swagger/Postman during development). When a real auth flow is added,
// it just calls setToken()/clear() here.

import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'collabai.accessToken';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly tokenSignal = signal<string | null>(readInitial());

  readonly token = this.tokenSignal.asReadonly();

  get(): string | null {
    return this.tokenSignal();
  }

  setToken(token: string): void {
    this.tokenSignal.set(token);
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch {
      /* storage unavailable — keep it in memory only */
    }
  }

  clear(): void {
    this.tokenSignal.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function readInitial(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
