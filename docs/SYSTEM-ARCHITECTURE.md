# CollabAI system architecture

The current stack and explicitly deferred technologies are maintained in [TECH-SCOPE.md](TECH-SCOPE.md).

```text
Angular 21 + Material + SCSS + signals
  ├─ API services ─────────────► NestJS 11 / Express adapter
  ├─ Socket.IO client ─────────► Realtime gateway
  └─ file PUT with short-lived URL ► S3

NestJS + CQRS
  ├─ Prisma ───────────────────► PostgreSQL
  ├─ EventEmitter2 / Socket.IO ► in-process events + live updates
  ├─ SendGrid ─────────────────► transactional email
  ├─ OpenAI / DeepSeek / Claude ► backend AI provider adapter
  ├─ S3 ──────────────────────► signed private uploads/downloads
  └─ Sentry + JSON stdout logs ► error tracking / deployment collector
```

The browser never receives cloud credentials or AI provider keys. API calls use the documented response envelope; protected calls include the JWT bearer token. RabbitMQ and React/Fastify rewrites are out of scope for the current implementation.
