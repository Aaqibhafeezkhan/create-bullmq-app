# create-bullmq-app

[![npm](https://img.shields.io/npm/v/create-bullmq-app)](https://www.npmjs.com/package/create-bullmq-app)
[![CI](https://github.com/Krrishkumar125/create-bullmq-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Krrishkumar125/create-bullmq-app/actions/workflows/ci.yml)

Scaffold a **production-ready BullMQ + TypeScript service** in one command: an HTTP API that validates and enqueues jobs, a separate worker process, health checks, graceful shutdown, Docker and CI that test against real Redis.

```bash
npm create bullmq-app@latest my-service
# or just `npm create bullmq-app@latest` and answer a few questions
```

## The problem

Every team that adopts BullMQ rediscovers the same production lessons the hard way:

- **Deploys leave jobs stuck in `active`** because workers are killed instead of drained ([r/node](https://www.reddit.com/r/node/comments/1lb7bdx/do_you_folks_face_problem_with_bullmq_when_worker/), [r/node: "lessons learned the hard way"](https://www.reddit.com/r/node/comments/1sk55lc/migrating_from_cron_jobs_to_bull_queues_in/)).
- **Workers crash or hang** because the Redis connection doesn't use `maxRetriesPerRequest: null`, while API producers _should_ fail fast.
- **Duplicate jobs** on client retries, because nobody set a deterministic `jobId`.
- **Redis fills up** because completed/failed jobs are never trimmed, or silently loses jobs because `maxmemory-policy` isn't `noeviction`.
- **No probes**: orchestrators can't tell a draining worker from a healthy one.

The [BullMQ "Going to production" guide](https://docs.bullmq.io/guide/going-to-production) explains these, but there is no maintained starter that wires them all together and tests them. Most people copy snippets from blog posts.

## What you get

|                         |                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **API** (Hono)          | `POST /jobs/:name` validates with Zod and enqueues (202), `GET /jobs/:name/:id` state, `GET /queues` counts                         |
| **Worker**              | separate process, concurrency from env, structured events for completed/failed/stalled                                              |
| **Graceful shutdown**   | SIGINT/SIGTERM → readiness flips to 503 → HTTP server / workers drain → hard timeout                                                |
| **Health**              | `/health/live` and `/health/ready` on both API and worker                                                                           |
| **Failed jobs / retry** | `GET /queues/:name/failed` (dead-letter view), `POST /jobs/:name/:id/retry`, `POST /queues/:name/retry-failed`                      |
| **Metrics**             | `GET /metrics` in Prometheus format (`bullmq_jobs{queue,state}`), no extra dependency                                               |
| **Cron jobs**           | `schedule: { pattern, tz }` on a job, registered with `upsertJobScheduler` so N workers never duplicate it                          |
| **Rate limits**         | `limiter: { max, duration }` per queue, enforced across all workers                                                                 |
| **Admin auth**          | set `ADMIN_TOKEN` to protect admin, metrics and retry routes with a bearer token                                                    |
| **Idempotency**         | optional `idempotencyKey` becomes a deterministic `jobId`                                                                           |
| **Safe defaults**       | exponential backoff, attempts, bounded `removeOnComplete/Fail`, correct Redis options for producers vs workers, TLS via `rediss://` |
| **Typed config**        | Zod-validated env that fails fast with a readable list of errors                                                                    |
| **Logging**             | pino JSON logs with secret redaction                                                                                                |
| **Docker**              | multi-stage non-root image, compose with Redis (`noeviction`, AOF), 2 worker replicas, `stop_grace_period`                          |
| **Tests + CI**          | Vitest unit tests plus integration tests against real Redis in GitHub Actions                                                       |

Adding a queue = one command: `npm run new:queue -- resize-image` writes `src/jobs/resize-image.ts` (name, payload schema, id, processor) and registers it.

## Options

```
npm create bullmq-app@latest [dir] [-y] [--no-docker] [--no-ci] [--no-install] [--no-git] [--pm npm|pnpm|yarn|bun]
```

## Quickstart (generated project)

```bash
cd my-service
cp .env.example .env
docker compose up -d redis
npm run dev:api
npm run dev:worker
curl -X POST localhost:3000/jobs/email -H 'content-type: application/json' \
  -d '{"to":"you@example.com","subject":"Hi","body":"Hello","idempotencyKey":"welcome-1"}'
```

## Compared with alternatives

|                                    | create-bullmq-app | Bull Board   | create-t3-app / Express starters | BullMQ docs examples |
| ---------------------------------- | ----------------- | ------------ | -------------------------------- | -------------------- |
| Scaffolds a runnable queue service | ✅                | ❌ (UI only) | ❌ no queues                     | ❌ snippets          |
| Separate API + worker processes    | ✅                | —            | ❌                               | partial              |
| Graceful drain + readiness flip    | ✅                | —            | rarely                           | snippet              |
| Producer vs worker Redis settings  | ✅                | —            | —                                | documented           |
| Idempotent enqueue                 | ✅                | —            | —                                | documented           |
| Tested against real Redis in CI    | ✅                | —            | —                                | —                    |

Bull Board pairs well with this: mount it in `src/app.ts` if you want a UI (a `--dashboard` flag is on the roadmap).

## Related tools

- [eslint-plugin-bullmq](https://github.com/Krrishkumar125/eslint-plugin-bullmq): lint rules from BullMQ's going-to-production guide. Generated projects already pass them.
- [eslint-plugin-webhook-safety](https://github.com/Krrishkumar125/eslint-plugin-webhook-safety): lint rules for Stripe webhook handlers that enqueue jobs.
- [webhook-crash-lab](https://github.com/Krrishkumar125/webhook-crash-lab) and its [MCP server / agent plugin](https://github.com/Krrishkumar125/webhook-crash-lab-mcp): replay duplicate and out-of-order webhooks against your app.

## Roadmap

- [x] Interactive setup, `new:queue` generator, Prometheus `/metrics`, cron + rate-limit examples, failed-job retry endpoints
- [ ] Optional Bull Board UI (`--dashboard`)
- [ ] Flow (parent/child) example
- [ ] Express and Fastify flavours
- [ ] OpenTelemetry tracing across producer → worker

## Development

```bash
npm test                         # CLI tests
node bin/index.js /tmp/demo      # try the scaffolder locally
```

MIT © Krrish Kumar
