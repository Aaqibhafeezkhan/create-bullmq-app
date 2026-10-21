# __APP_NAME__

BullMQ + TypeScript service scaffolded with `create-bullmq-app`.

```bash
cp .env.example .env
docker compose up -d redis
npm run dev:api      # http://localhost:3000
npm run dev:worker
curl -X POST localhost:3000/jobs/email -H 'content-type: application/json' \
  -d '{"to":"you@example.com","subject":"Hi","body":"Hello","idempotencyKey":"welcome-1"}'
```

Add a queue: `npm run new:queue -- resize-image` creates `src/jobs/resize-image.ts` and registers it.

Per-queue options live next to the processor in each job file:

- `limiter: { max: 10, duration: 1000 }`: rate limit across all workers (see `email.ts`).
- `schedule: { pattern: '0 9 * * *', tz: 'Asia/Kolkata', data }`: cron job, registered idempotently on worker start (see `daily-report.ts`).
- `concurrency`: per-queue override of `WORKER_CONCURRENCY`.

Set `ADMIN_TOKEN` to require `Authorization: Bearer <token>` on `/queues*`, `/metrics` and the retry endpoints.

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` | liveness (no Redis) |
| `GET /health/ready` | readiness (Redis ping, 503 while draining) |
| `POST /jobs/:name` | validate + enqueue (202) |
| `GET /jobs/:name/:id` | job state, attempts, result |
| `GET /queues` | job counts per queue |
| `GET /queues/:name/failed?limit=20` | failed jobs that used up every retry (dead-letter view) |
| `POST /jobs/:name/:id/retry` | retry one failed job |
| `POST /queues/:name/retry-failed` | retry every failed job in a queue |
| `GET /metrics` | Prometheus metrics (`bullmq_jobs{queue,state}`) |
