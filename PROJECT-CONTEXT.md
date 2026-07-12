# CollabAI Frontend Project Context

This is the Angular/TypeScript frontend for CollabAI.

## Current implementation slice

Application code is organized under `src/app` by feature and domain:

- `core/` — shell layout, toast, workspace context, mock-era domain stores
- `features/` — dashboard, board, team, profile pages
- `shared/` — domain models and pure helpers
- `data/mock/` — seed data until API services are wired

Routing uses Angular Router (`app.routes.ts` + `app.config.ts`).

The first working UI slice implements a polished mock-data frontend based on:

- `docs/SRS-EXTRACTED.txt` from the attached SRS PDF.
- The provided AI-generated UX/UI screenshots, used only as visual reference.
- `docs/API-CONTRACT.md` for future backend integration field names.

## SRS-confirmed frontend scope

- Angular with TypeScript.
- Responsive web app for desktop, laptop, tablet, and smartphone.
- Dashboard and analytics.
- Project pages and navigation.
- Kanban board with drag/drop.
- Task CRUD UI flows and task detail modal/panel.
- Comments and activity log components.
- AI task description, subtask suggestion, smart search, recommendations, and prioritization UI surfaces.
- JWT auth pages and protected routes in a later slice.

## UI reference decisions

Use from screenshots:

- Clean white/purple dashboard style.
- Left sidebar on desktop, compact bottom navigation on mobile.
- Dashboard stat cards, project cards, activity feed, upcoming tasks.
- Kanban columns with task cards and right-side task detail panel.
- Team management table and invite panel.
- AI suggestions page.

Defer/remove from MVP unless time permits:

- File attachments.
- Calendar/timeline/files tabs as real features.
- Complex role/permission management screens.
- Email verification/OAuth.
- Full AI auto-scheduling and workload balancing actions.

## Run commands

```bash
pnpm install
pnpm start
pnpm build
pnpm typecheck
```
