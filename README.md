# CollabAI Frontend

This is the separate frontend workspace for CollabAI.

## Quick start for teammates

Use Node 20.19+ or Node 22/24 with pnpm 10. If you have Corepack available, it will install the pinned pnpm version from `package.json`.

```bash
corepack enable
pnpm install
pnpm dev
```

Open:

```txt
http://localhost:4200
```

Before pushing changes, run:

```bash
pnpm check
```

That runs the same verification used for this frontend:

```bash
pnpm typecheck
pnpm build
```

If `pnpm install` says your Node version is unsupported, install Node 22 LTS and rerun the commands above.

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

## Project scripts

```bash
pnpm install    # install dependencies
pnpm dev        # run the Angular dev server on port 4200
pnpm typecheck  # run TypeScript checks
pnpm build      # create a production build
pnpm check      # typecheck + build
```

If port `4200` is already busy, run Angular directly on another port:

```bash
pnpm ng serve --host=0.0.0.0 --port=4300
```

## Integration rule

Do not invent request/response shapes. Use `docs/API-CONTRACT.md` and `docs/TYPESCRIPT-TYPES.md`.
