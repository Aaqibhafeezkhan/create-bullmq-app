# create-bullmq-app

## 0.2.3

### Patch Changes

- Generated projects rate-limit repeated Redis connection error logs instead of flooding the console. Thanks @Aaqibhafeezkhan (#6).

## 0.2.2

### Patch Changes

- Generated projects now include ESLint (`npm run lint`) with typescript-eslint and eslint-plugin-bullmq's recommended preset, and CI runs it.

## 0.2.1

### Patch Changes

- npm metadata: shorter description, focused keywords, homepage/bugs links; README links sibling packages.

## 0.2.0

- Bun support: `bunx create-bullmq-app` / `bun create bullmq-app` is detected, and `--pm bun` is accepted.
- pnpm, yarn and bun projects no longer ship the npm `package-lock.json`. Their generated CI workflow and README
  use that package manager (setup action, frozen install, `<pm> run ...`).
- Fix: `pnpm run new:queue -- <name>` (and yarn) failed because those package managers pass a literal `--`
  to the script. Next steps now print `<pm> run new:queue <name>` for non-npm managers.
- Tests run on Windows in CI, and generated pnpm/bun projects are typechecked, tested against Redis and built in CI.

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
