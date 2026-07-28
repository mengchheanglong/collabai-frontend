# Backend ↔ Frontend Integration Plan

> Goal: connect the Angular frontend (`collabai-frontend`) to the NestJS backend
> (`../collabai-backend`), phase by phase, **one committed, reviewable slice at a time**.
> Spans both repos. Analytics/Boards/Sockets/Users-search will be **built** where missing.

## Locked decisions (from review)
1. **Shape reconciliation → backend adapts to the contract.** Backend emits the contract
   envelope `{ success, data, meta? }` / error `{ success:false, error:{ code, message, details? } }`
   and `_id` (not `id`). Frontend adds thin HTTP services that map contract DTOs → its
   existing component models.
2. **Auth → keep the backend's cookie + email-verification + refresh model; the frontend
   adapts.** Frontend builds register (firstName/lastName), email-verification, login,
   password-reset UI, uses `withCredentials` (refresh cookie) + a bearer access token.
   - ⚠️ **Additive item to confirm:** backend has no `GET /auth/me`. Under cookie auth the
     frontend needs the current user, so this plan **adds a read-only `GET /auth/me`**. It
     does not change the auth model. Flagging because it's a new endpoint.
3. **Build all currently-missing backend pieces:** Users search, Boards, Analytics, Realtime
   sockets.
4. **Enums → align the frontend to the backend.** Frontend drops the `review` status and
   uses `todo|in_progress|done` + `urgent` (was `critical`). Frontend-only changes.

## Known extra gap (not a decision — a fact to handle)
The frontend's **component models differ from its own contract docs** (`assignee` name vs
`assigneeId`, `project` name vs `projectId`, `tags` vs `labels`, string ids vs `_id`,
`comments` count vs `commentCount`). Each frontend phase therefore includes a **mapping
layer** (contract DTO ↔ component model) so real data flows without rewriting every
component at once.

## Conventions
- **Branches:** `feat/integration` in **each** repo (created before the first commit; both
  are currently on `main`).
- **Commits:** one per phase, in the repo(s) that phase touches. Frontend phases that need a
  backend change are split into a backend commit + a frontend commit under the same phase.
- **Review gate:** after each phase I stop; you review the commit(s); then I continue.
- **Backend cross-cutting (built in Phase 0, applied everywhere after):**
  - envelope interceptor → `{ success, data, meta? }`; list endpoints attach `meta`.
  - global exception filter → `{ success:false, error:{ code, message, details? } }`
    (existing module error codes preserved).
  - `id → _id` in serialized output.
- **Frontend cross-cutting (Phase 1):** `environment.ts` with `apiBaseUrl` =
  `http://localhost:4000/api/v1`; HTTP interceptors for `withCredentials` + bearer token +
  401→refresh→retry; a typed `ApiResponse<T>` unwrap helper.
- **Verify each phase:** backend `tsc` + affected tests; frontend `pnpm typecheck && pnpm build`.

---

## Phases

### Phase 0 — Backend integration foundation  *(backend repo)*
Make the backend addressable and contract-shaped; nothing frontend yet.
- `main.ts`: port **4000**, `setGlobalPrefix('api/v1')`, `enableCors({ origin: 'http://localhost:4200', credentials: true })`.
- Global **response-envelope interceptor** + **exception filter** (contract shapes).
- **`id → _id`** output serialization.
- `GET /health`.
- **DoD:** `GET http://localhost:4000/api/v1/health` returns `{ success:true, data:{ status:'ok' } }`; an existing endpoint returns the enveloped shape with `_id`.
- **Commit:** `feat(api): serve /api/v1 on :4000 with contract envelope + CORS`.

### Phase 1 — Auth  *(backend only — FRONTEND AUTH SKIPPED per user)*
> User: the frontend auth UI isn't available yet — **skip the frontend auth part.**
- **Backend:** add read-only `GET /auth/me`; confirm all auth routes envelope cleanly; CORS credentials verified.
- **Frontend:** SKIPPED for now (no login/register/verify pages, no guard). The frontend HTTP
  layer (Phase 1-lite) still sets up `environment.ts` + interceptors so a **manually-supplied
  access token** (from Swagger/Postman, stored in `localStorage`) is attached to requests —
  this unblocks Phases 2+ in the browser without a login screen.
- ⚠️ **Consequence:** guarded endpoints can't be exercised in-browser without a token. Decide
  at Phase 2 whether to (a) use a manual dev token, or (b) make selected endpoints dev-open.
- **DoD:** `GET /auth/me` returns the current user for a valid token; frontend attaches a
  stored token to API calls.
- **Commit:** backend `feat(auth): add GET /auth/me`.

### Phase 2 — Projects, members & users search  *(both repos)*
- **Backend:** add `GET /users/search`. Projects/members already built — verify enveloped/`_id`.
- **Frontend:** `ProjectService` + `MemberService`; replace mock project/workspace + member-directory stores with real data; dashboard project list/create; team page members + invite (uses users search).
- **DoD:** create/list/open projects; add/remove/re-role members against the real DB.
- **Commits:** backend `feat(users): GET /users/search`; frontend `feat(projects): wire projects + members`.

### Phase 3 — Boards  *(backend + frontend)*
- **Backend (new domain):** `Board` model + migration; `Task.boardId`; endpoints `GET/POST /projects/:id/boards`, `GET /boards/:id?includeTasks=true`, `PATCH/DELETE /boards/:id`; **create default "Main Board" on project create**.
- **Frontend:** board selection wired to real boards; board page loads via `GET /boards/:id?includeTasks=true`.
- **DoD:** each new project has a Main Board; board page loads its tasks from the API.
- **Commits:** backend `feat(boards): board domain + default board`; frontend `feat(boards): load board + tasks`.

### Phase 4 — Tasks & kanban (+ enum alignment) *(both repos)* - **[DONE]**
- **Frontend enum alignment:** drop `review`; map/rename `critical → urgent`; board columns = todo/in_progress/done.
- **Frontend:** `TaskService`; replace `TaskStoreService` mock seed with real list/create/update/move(status+position)/delete + subtasks; CDK drag/drop calls `PATCH /tasks/:id/status` with optimistic update + rollback.
- **Backend:** tasks already built (Phase 2 of the business-logic pass) — verify shapes; `Task.position` migration applied here if not already.
- **DoD:** kanban board fully live (create/edit/move/delete/subtasks) against the DB.
- **Commit:** frontend `feat(tasks): wire kanban to API`; backend commit only if shape fixes needed.

### Phase 5 — Comments  *(frontend)*
- `CommentService`; task detail comment thread loads/creates/edits/deletes via API; `commentCount` from the task DTO.
- **DoD:** task detail comments are real end-to-end.
- **Commit:** frontend `feat(comments): wire task comments`.

### Phase 6 — Notifications  *(frontend)*
- `NotificationService`; notification list + unread badge + mark-read/all from API (backend already generates them from task-assign/mention events).
- **DoD:** assigning a task / @mention produces a real notification the assignee sees.
- **Commit:** frontend `feat(notifications): wire notifications`.

### Phase 7 — Analytics  *(both repos)*
- **Backend (new):** `GET /projects/:id/analytics/summary` + `/burndown` (Prisma aggregations).
- **Frontend:** dashboard stat cards + charts consume real analytics.
- **DoD:** dashboard numbers/charts reflect real task data.
- **Commits:** backend `feat(analytics): summary + burndown`; frontend `feat(dashboard): real analytics`.

### Phase 8 — AI  *(frontend, backend already built)*
- Replace `AiService` mock internals with real `POST /ai/*` calls (subtasks, description, summarize-comments, search-tasks); keep method signatures so components don't change.
- **DoD:** AI buttons/panels hit the backend (stub provider if no `OPENAI_API_KEY`).
- **Commit:** frontend `feat(ai): call real AI endpoints`.

### Phase 9 — Realtime (Socket.io)  *(both repos)*
- **Backend (new):** `EventsGateway` on `:4000`, JWT handshake, `project:{id}` rooms; emit-after-write for task/comment/project/member/board events (per `REALTIME-SOCKET-CONTRACT.md`).
- **Frontend:** socket client; join/leave project room; live-apply events; refetch board on reconnect.
- **DoD:** two browsers on one board see each other's changes live.
- **Commits:** backend `feat(realtime): socket gateway + emits`; frontend `feat(realtime): live board updates`.

### Phase 10 — Cleanup & verification  *(both repos)*
- Remove `data/mock/*` usage; ensure all stores are API-backed; end-to-end pass of the whole flow (register→verify→login→project→board→task→comment→notification→analytics→AI); `pnpm check` green; backend `tsc` + tests green.
- **Commit:** `chore(integration): remove mocks + final verification`.

---

## Progress
- [x] Plan written (this file)
- [~] **Phase 1 Auth — SKIPPED** (user: "skip auth feature"). No `GET /auth/me`, no auth work.
      Guards stay in place; the frontend HTTP layer attaches a bearer token from `localStorage`
      if present (token supplied manually / auth added later).
- [x] **Phase 0 Backend foundation — DONE** (backend `feat/integration`, commit `771b012`).
      /api/v1 on :4000, CORS+credentials, `{success,data,meta}` envelope + `id→_id`, contract
      error shape across all module filters, `GET /health`. Preceded by committing the
      outstanding AI module (`2c4b7e6`). ⚠️ Not boot-verified — the configured Postgres is
      unreachable from the build environment (Prisma `$connect` fails at startup).
- [ ] Phase 1 Auth
- [x] **Phase 2 Projects + members + users search — CONNECTED** (`pnpm typecheck && pnpm build` green).
      - Backend: new `users` module → `GET /users/search` (wired into AppModule). tsc clean.
      - Frontend API layer: `environment.ts`, `api.types.ts`, `TokenStore`, `authInterceptor`
        (credentials + bearer), `ApiClient` (envelope unwrap), `ProjectApiService`, `UserApiService`;
        interceptor registered in `app.config.ts`.
      - **Dashboard projects** now load from the backend: `WorkspaceContextService` fetches the
        user's projects via `ProjectApiService` and maps `ProjectDto → Project`.
      - **Team page** now backed by the API: `MemberDirectoryService` loads the first project's
        members (`ProjectMemberDto → Member`), and invite/role/remove call the real
        members endpoints (optimistic, reload on error). Role mapping owner/admin→Admin,
        member→Member, viewer→Viewer.
      - Workspaces stay a local grouping (backend has none); the board still filters mock tasks
        by seed workspace names until the tasks phase.
      - ⚠️ **To test:** auth is skipped, so put a valid access token in `localStorage`
        (`collabai.accessToken`) or the API calls 401 and lists show empty.
- [ ] Phase 3 Boards
- [ ] Phase 4 Tasks + enum alignment
- [ ] Phase 5 Comments
- [ ] Phase 6 Notifications
- [ ] Phase 7 Analytics
- [ ] Phase 8 AI
- [ ] Phase 9 Realtime
- [ ] Phase 10 Cleanup

## Open items to confirm before Phase 1
- **`GET /auth/me`** addition (see decision 2) — OK to add?
- **DB migrations:** Phases 3/4/7 need `prisma migrate` against a real database. Confirm a
  Postgres is available (Board table, `Task.boardId`, `Task.position`), or these phases stop
  at code + a migration file you run.
