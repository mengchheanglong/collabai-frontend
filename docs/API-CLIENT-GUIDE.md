# Frontend API Client Guide

This file maps frontend services to backend endpoints so frontend can be built before backend is fully ready.

## API response envelope TypeScript

```ts
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

## Token handling

- Store token in `localStorage` for MVP simplicity.
- Key: `collabai.accessToken`.
- Add interceptor:

```http
Authorization: Bearer ***
```

- On `401`, clear token and redirect to `/login`.

## Service-to-endpoint map

| Frontend method | HTTP endpoint | Notes |
|---|---|---|
| `auth.register()` | `POST /auth/register` | stores token |
| `auth.login()` | `POST /auth/login` | stores token |
| `auth.loadMe()` | `GET /auth/me` | app startup |
| `projects.list()` | `GET /projects` | dashboard |
| `projects.create()` | `POST /projects` | default board created by backend |
| `projects.get()` | `GET /projects/:projectId` | project page |
| `projects.update()` | `PATCH /projects/:projectId` | settings |
| `projects.delete()` | `DELETE /projects/:projectId` | owner only |
| `members.list()` | `GET /projects/:projectId/members` | members panel |
| `members.add()` | `POST /projects/:projectId/members` | invite/add existing user |
| `boards.list()` | `GET /projects/:projectId/boards` | project page |
| `boards.get(true)` | `GET /boards/:boardId?includeTasks=true` | board page |
| `tasks.list()` | `GET /projects/:projectId/tasks` | filters/search |
| `tasks.create()` | `POST /tasks` | create dialog |
| `tasks.update()` | `PATCH /tasks/:taskId` | detail dialog |
| `tasks.move()` | `PATCH /tasks/:taskId/status` | drag/drop |
| `comments.create()` | `POST /tasks/:taskId/comments` | task detail |
| `ai.subtasks()` | `POST /ai/subtasks` | AI button |
| `ai.description()` | `POST /ai/description` | AI button |
| `ai.summarizeComments()` | `POST /ai/summarize-comments` | comments panel |

## Mocking strategy if backend is not ready

Frontend can create a temporary `MockApiClient` that returns the exact DTO shapes from `docs/02-API-CONTRACT.md`.

Rules:

- Mock DTOs must use real-looking ObjectId strings.
- Mock must preserve response envelope shape.
- Do not invent different field names.
- Replace mock with real `HttpClient` before final integration.

## Drag/drop integration

When Angular CDK drop happens:

1. Determine new status from destination column.
2. Determine new position.
3. Optimistically update UI.
4. Call `tasks.move(taskId, status, position)`.
5. If request fails, rollback UI and show snackbar.

Position suggestion:

- If moved to bottom, use last position + 1000.
- If inserted between two tasks, use average of neighbor positions.
- If positions get too close, backend can normalize later.

## Socket integration

On project/board page init:

```ts
socket.connect(token);
socket.joinProject(projectId);
```

Listen to:

- `task:created`
- `task:updated`
- `task:moved`
- `task:deleted`
- `comment:created`
- `project:updated`

On destroy:

```ts
socket.leaveProject(projectId);
```

On reconnect:

- refetch current board with `GET /boards/:boardId?includeTasks=true`.

