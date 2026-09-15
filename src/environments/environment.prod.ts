// src/environments/environment.prod.ts
// Production configuration for CollabAI frontend.
// Supports runtime override via window.__COLLABAI_CONFIG__ or falls back to relative /api/v1.

export const environment = {
  production: true,
  apiBaseUrl:
    (typeof window !== 'undefined' &&
      (window as any).__COLLABAI_CONFIG__?.apiBaseUrl) ||
    '/api/v1',
  socketUrl:
    (typeof window !== 'undefined' &&
      (window as any).__COLLABAI_CONFIG__?.socketUrl) ||
    '',
};
