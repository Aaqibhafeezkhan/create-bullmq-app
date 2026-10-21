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

Add a queue: copy `src/jobs/email.ts`, then register it in `src/jobs/index.ts`.

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` | liveness (no Redis) |
| `GET /health/ready` | readiness (Redis ping, 503 while draining) |
| `POST /jobs/:name` | validate + enqueue (202) |
| `GET /jobs/:name/:id` | job state, attempts, result |
| `GET /queues` | job counts per queue |
