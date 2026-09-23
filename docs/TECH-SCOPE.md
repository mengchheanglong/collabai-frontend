# CollabAI approved technology scope

This is the approved technology baseline for the product. The extracted SRS and early planning docs are historical source material where their stack assumptions differ.

## Approved stack

- **Client:** Angular 21 and TypeScript with standalone components, Angular Router, Angular Material, SCSS, signals, and reactive forms.
- **API:** NestJS 11 on the Express adapter, PostgreSQL/Prisma; routes use `/api/v1` and authenticated calls carry JWT bearer tokens.
- **Realtime:** Socket.IO client; Redis is a backend deployment option for shared auth/rate-limit state.
- **Files:** avatars upload with an API-issued S3 presigned URL and store the returned CloudFront/S3 URL. Attachments use project-scoped S3 upload and short-lived download URLs.
- **AI:** OpenAI, DeepSeek, and Anthropic Claude are selectable server-side providers; keys remain server-side. `AI_PROVIDER` chooses the provider, and the backend example environment selects DeepSeek. If the setting is unset or unrecognized, the backend selects OpenAI when configured, otherwise the deterministic stub. If DeepSeek or Anthropic is selected without its key, selection falls through to configured OpenAI, then to the stub if OpenAI is also unavailable. Provider request or response-parsing failures fall back to the deterministic stub, not another LLM. There is no automatic OpenAI-to-Anthropic or Anthropic-to-OpenAI failover. Dashboard recommendations identify whether they came from a configured model or deterministic fallback.
- **Delivery:** GitHub Actions checks and a multi-stage container build serves Angular assets through Nginx.

## Workspace boundary

For this product, each **project is a workspace**. Its members share that project's boards, tasks, documents, and collaboration. There is no parent organization/workspace that groups multiple projects under one shared team or membership list. Cross-project organizations and memberships are outside the current scope.

## Deferred and excluded technologies

- React/Vite/Zustand/TanStack/Tailwind/React Hook Form: the current frontend is Angular; no rewrite is planned.
- RabbitMQ: deferred for the current release. Domain events are in-process; reconsider a broker if durable, retryable background jobs or independent consumers become a product requirement.
- Fastify: the API uses Nest's Express adapter.
- Frontend access to cloud or AI secrets: the browser only receives presigned upload URLs and public asset URLs.

See `../.env.example` for public frontend environment defaults. Docker builds accept `API_BASE_URL`; local development uses `http://localhost:4000/api/v1`.
