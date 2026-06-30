# CollabAI Frontend Agent Instructions

You are working only on the CollabAI Angular frontend.

## Read order

1. `README.md`
2. `.active/SESSION-START.md`
3. `docs/API-CONTRACT.md`
4. `docs/TYPESCRIPT-TYPES.md`
5. `docs/FRONTEND-SPEC.md`
6. `docs/API-CLIENT-GUIDE.md`
7. If touching realtime: `docs/REALTIME-SOCKET-CONTRACT.md`
8. If touching AI UI: `docs/AI-FEATURES.md`

## Rules

- Do not place OpenAI/Groq keys in frontend code.
- All AI actions call backend `/api/v1/ai/*` endpoints.
- All protected HTTP calls must use `Authorization: Bearer <token>`.
- Token key for MVP: `collabai.accessToken`.
- Every API service method must match `docs/API-CONTRACT.md`.
- If an API shape is missing or confusing, update docs first or ask backend member.
- Use loading, error, empty, and success states for every page.

## Main implementation order

1. Generate Angular app.
2. Add environment config.
3. Add shared DTO types.
4. Add AuthService, auth guard, token interceptor.
5. Build login/register pages.
6. Build dashboard + project CRUD UI.
7. Build board/Kanban UI.
8. Add task detail + comments.
9. Add AI buttons and smart search.
10. Add Socket.io updates.
