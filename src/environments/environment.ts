// src/environments/environment.ts
// Non-secret public config. Points at the backend's /api/v1 base (see docs/API-CONTRACT.md).
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:4000/api/v1',
  socketUrl: 'http://localhost:4000',
};
