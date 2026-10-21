# create-bullmq-app

## 0.1.1

- Fix: the CLI did nothing when run via `npm create` / `npx`, because the entry check compared the `.bin` symlink path with the real file. It now compares real paths (regression test added).
- Fix: scaffolding failed when the CLI was installed from npm, because the copy filter skipped every path containing `node_modules`, including the template itself. The filter now looks only at paths inside the template.

## 0.1.0

First public release.

- Scaffolds a BullMQ + TypeScript service: Hono API, separate worker, graceful shutdown, health checks, typed env, pino logs, Docker, CI against real Redis.
- Interactive prompts when run without a directory; `-y` and `--no-*` flags for CI.
- `npm run new:queue -- <name>` generator in generated projects.
- `GET /metrics` Prometheus endpoint, failed-job listing and retry endpoints, optional `ADMIN_TOKEN` bearer auth.
- Cron (`upsertJobScheduler`) and per-queue rate-limit examples.
