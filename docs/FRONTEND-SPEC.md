# CollabAI Frontend Spec

Frontend stack:

- Angular 18+.
- Standalone components.
- Angular Router.
- Angular Material.
- Angular CDK drag/drop.
- Signals for state.
- Socket.io client.

## Frontend goals

- Provide clean UI for auth, dashboard, projects, Kanban board, task details, comments, AI tools, activity, and analytics.
- Match backend API contract exactly.
- Keep all API calls inside services.
- Keep UI components dumb when possible; services own HTTP and state.

## Suggested Angular project structure

```txt
frontend/
  collabai-frontend/
    src/
      app/
        app.config.ts
        app.routes.ts
        core/
          auth/
            auth.service.ts
            auth.guard.ts
            auth.interceptor.ts
            auth.models.ts
          api/
            api-client.ts
            api-error.ts
          socket/
            socket.service.ts
          layout/
            shell.component.ts
            top-nav.component.ts
            side-nav.component.ts
        features/
          auth/
            login-page.component.ts
            register-page.component.ts
          dashboard/
            dashboard-page.component.ts
            project-card.component.ts
            create-project-dialog.component.ts
          projects/
            project-page.component.ts
            project-settings.component.ts
            members-panel.component.ts
          boards/
            board-page.component.ts
            kanban-column.component.ts
            task-card.component.ts
          tasks/
            task-detail-dialog.component.ts
            task-form.component.ts
            subtasks-list.component.ts
          comments/
            comments-panel.component.ts
            comment-form.component.ts
          ai/
            ai-subtasks-button.component.ts
            ai-description-button.component.ts
            ai-summary-panel.component.ts
            smart-search.component.ts
          analytics/
            analytics-page.component.ts
          activity/
            activity-feed.component.ts
        shared/
          models/
            api.types.ts
          ui/
            loading-state.component.ts
            empty-state.component.ts
            error-state.component.ts
      environments/
        environment.ts
        environment.development.ts
```

## Routes

```ts
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then(m => m.LoginPageComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register-page.component').then(m => m.RegisterPageComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent) },
      { path: 'projects/:projectId', loadComponent: () => import('./features/projects/project-page.component').then(m => m.ProjectPageComponent) },
      { path: 'projects/:projectId/boards/:boardId', loadComponent: () => import('./features/boards/board-page.component').then(m => m.BoardPageComponent) },
      { path: 'projects/:projectId/analytics', loadComponent: () => import('./features/analytics/analytics-page.component').then(m => m.AnalyticsPageComponent) }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
```

## Environment config

```ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:4000/api/v1',
  socketUrl: 'http://localhost:4000'
};
```

## Required services

### AuthService

Responsibilities:

- `register(name, email, password)` -> `POST /auth/register`.
- `login(email, password)` -> `POST /auth/login`.
- `logout()` -> deletes token and optionally calls `POST /auth/logout`.
- `loadMe()` -> `GET /auth/me`.
- stores current user as signal.
- exposes `isAuthenticated` computed signal.

### ApiClient

Thin wrapper around Angular HttpClient:

- attaches base URL.
- returns typed response envelopes.
- centralizes error conversion.

### ProjectService

Methods:

- `listProjects(params)` -> `GET /projects`.
- `createProject(body)` -> `POST /projects`.
- `getProject(projectId)` -> `GET /projects/:projectId`.
- `updateProject(projectId, body)` -> `PATCH /projects/:projectId`.
- `deleteProject(projectId)` -> `DELETE /projects/:projectId`.
- member methods from API contract.

### BoardService

Methods:

- `listBoards(projectId)` -> `GET /projects/:projectId/boards`.
- `createBoard(projectId, body)` -> `POST /projects/:projectId/boards`.
- `getBoard(boardId, includeTasks)` -> `GET /boards/:boardId`.
- `updateBoard(boardId, body)` -> `PATCH /boards/:boardId`.
- `deleteBoard(boardId)` -> `DELETE /boards/:boardId`.

### TaskService

Methods:

- `listTasks(projectId, filters)` -> `GET /projects/:projectId/tasks`.
- `createTask(body)` -> `POST /tasks`.
- `getTask(taskId)` -> `GET /tasks/:taskId`.
- `updateTask(taskId, body)` -> `PATCH /tasks/:taskId`.
- `moveTask(taskId, status, position)` -> `PATCH /tasks/:taskId/status`.
- `deleteTask(taskId)` -> `DELETE /tasks/:taskId`.

### CommentService

Methods:

- `listComments(taskId)` -> `GET /tasks/:taskId/comments`.
- `createComment(taskId, body)` -> `POST /tasks/:taskId/comments`.
- `updateComment(commentId, body)` -> `PATCH /comments/:commentId`.
- `deleteComment(commentId)` -> `DELETE /comments/:commentId`.

### AiService

Methods:

- `generateSubtasks(body)` -> `POST /ai/subtasks`.
- `generateDescription(body)` -> `POST /ai/description`.
- `summarizeComments(taskId)` -> `POST /ai/summarize-comments`.
- `searchTasks(projectId, query)` -> `POST /ai/search-tasks`.

### SocketService

Responsibilities:

- connect with JWT after login.
- join/leave project rooms.
- expose event streams/signals for task/comment/project updates.
- reconnect and refetch board after reconnect.

## Page/component behavior

### Login page

- Email and password fields.
- Submit calls AuthService.login.
- On success: redirect to `/dashboard`.
- On error: show friendly message.

### Register page

- Name, email, password fields.
- Submit calls AuthService.register.
- On success: redirect to `/dashboard`.

### Dashboard page

- Load projects from `GET /projects`.
- Show project cards with name, description, member count, progress summary if available.
- Create project dialog calls `POST /projects`.

### Project page

- Load project and boards.
- Show members panel.
- Show board links.
- Join socket room for project.

### Board page

- Load board with tasks using `GET /boards/:boardId?includeTasks=true`.
- Render columns from board columns.
- Render task cards grouped by status.
- Drag/drop calls `PATCH /tasks/:taskId/status`.
- Create task dialog calls `POST /tasks`.
- Task card click opens task detail dialog.

### Task detail dialog

- Shows title, description, status, priority, assignee, dueDate, labels, subtasks.
- Saves edits with `PATCH /tasks/:taskId`.
- Comments panel uses comment endpoints.
- AI buttons call AI endpoints.

### Analytics page

- Load summary from `GET /projects/:projectId/analytics/summary`.
- Load burndown from `GET /projects/:projectId/analytics/burndown`.
- Display simple cards/charts.

## UI states required for every API screen

- Loading state.
- Empty state.
- Error state with retry.
- Disabled submit button while request is pending.
- Toast/snackbar after create/update/delete.

## Frontend integration checklist

Before frontend member says a feature is done:

- Service method points to exact API path.
- Request body matches `docs/02-API-CONTRACT.md`.
- Response parsing handles envelope `{ success, data }`.
- Unauthorized errors redirect to login.
- User cannot access protected route without token.
- Component has loading/error/empty states.
- If the feature changes shared types, update `shared/TYPESCRIPT-TYPES.md`.

