# CollabAI Frontend

This is the separate frontend workspace for CollabAI.

Shared/canonical project docs can live in a sibling folder if your team keeps one:

```txt
../collabai
```

This frontend repo also contains its own `docs/` copy, so teammates can work from this repo alone.

Backend workspace should be cloned as a sibling folder:

```txt
../collabai-backend
```

## What this folder is for

Use this folder for the Angular app only:

- Angular 18+ standalone components.
- Angular Router.
- Angular Material.
- Angular CDK drag/drop Kanban.
- Services + signals.
- Socket.io client.

## Start here

1. Read `AGENTS.md`.
2. Read `.active/SESSION-START.md`.
3. Read `docs/API-CONTRACT.md` before creating/changing services.
4. Read `docs/FRONTEND-SPEC.md` for routes/components/services.
5. Read `docs/API-CLIENT-GUIDE.md` for exact frontend-to-backend mapping.

## Backend connection defaults

```txt
API base URL: http://localhost:4000/api/v1
Socket URL:   http://localhost:4000
```

## Recommended Angular app creation

Run from this folder:

```bash
ng new collabai-frontend --standalone --routing --style=scss
```

If you want files directly in this folder instead of nested `collabai-frontend/`, use Angular CLI options carefully or move generated files after creation.

## Integration rule

Do not invent request/response shapes. Use `docs/API-CONTRACT.md` and `docs/TYPESCRIPT-TYPES.md`.
