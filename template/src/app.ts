import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { HTTPException } from 'hono/http-exception';
import { renderMetrics } from './metrics.js';
import type { Queue } from 'bullmq';
import { jobs } from './jobs/index.js';
import type { Logger } from './lib/logger.js';

export interface AppDeps {
  queues: Map<string, Queue>;
  logger: Logger;
  isShuttingDown: () => boolean;
  /** When set, /queues*, /metrics and retry endpoints require `Authorization: Bearer <token>`. */
  adminToken?: string | undefined;
}

export function createApp({ queues, logger, isShuttingDown, adminToken }: AppDeps) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    logger.error({ err, path: c.req.path }, 'unhandled error');
    return c.json({ error: 'internal_error' }, 500);
  });

  /** Liveness: process is up. Never touches Redis. */
  app.get('/health/live', (c) => c.json({ status: 'ok' }));

  /** Readiness: Redis reachable and not draining. */
  app.get('/health/ready', async (c) => {
    if (isShuttingDown()) return c.json({ status: 'shutting_down' }, 503);
    try {
      const first = queues.values().next().value as Queue | undefined;
      // A cheap real round-trip to Redis; fails fast because producers disable the offline queue.
      if (first) await withTimeout(first.getJobCounts('waiting'), 2000);
      return c.json({ status: 'ok' });
    } catch (err) {
      logger.warn({ err }, 'readiness check failed');
      return c.json({ status: 'redis_unavailable' }, 503);
    }
  });

  /** Enqueue a job: POST /jobs/:name with a JSON payload validated by the job's schema. */
  app.post('/jobs/:name', async (c) => {
    const name = c.req.param('name');
    const def = jobs[name];
    const queue = queues.get(name);
    if (!def || !queue) return c.json({ error: 'unknown_queue', name }, 404);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }
    const parsed = def.payload.safeParse(body);
    if (!parsed.success) return c.json({ error: 'validation_failed', issues: parsed.error.issues }, 422);
    const jobId = def.jobId(parsed.data);
    const job = await queue.add(name, parsed.data, jobId ? { jobId } : undefined);
    return c.json({ id: job.id, queue: name }, 202);
  });

  /** Inspect a job's state. */
  app.get('/jobs/:name/:id', async (c) => {
    const queue = queues.get(c.req.param('name'));
    if (!queue) return c.json({ error: 'unknown_queue' }, 404);
    const job = await queue.getJob(c.req.param('id'));
    if (!job) return c.json({ error: 'not_found' }, 404);
    return c.json({
      id: job.id,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      progress: job.progress,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
    });
  });

  if (adminToken) {
    const auth = bearerAuth({ token: adminToken });
    app.use('/queues/*', auth);
    app.use('/queues', auth);
    app.use('/metrics', auth);
    app.use('/jobs/:name/:id/retry', auth);
  }

  /** Retry one failed job (manual dead-letter handling). */
  app.post('/jobs/:name/:id/retry', async (c) => {
    const queue = queues.get(c.req.param('name'));
    if (!queue) return c.json({ error: 'unknown_queue' }, 404);
    const job = await queue.getJob(c.req.param('id'));
    if (!job) return c.json({ error: 'not_found' }, 404);
    if ((await job.getState()) !== 'failed') return c.json({ error: 'not_failed' }, 409);
    await job.retry('failed');
    return c.json({ id: job.id, retried: true }, 202);
  });

  /** Failed jobs that used up every attempt: the dead-letter view. */
  app.get('/queues/:name/failed', async (c) => {
    const queue = queues.get(c.req.param('name'));
    if (!queue) return c.json({ error: 'unknown_queue' }, 404);
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20) || 20, 1), 100);
    const failed = await queue.getFailed(0, limit - 1);
    return c.json(
      failed.map((j) => ({ id: j.id, attemptsMade: j.attemptsMade, failedReason: j.failedReason, finishedOn: j.finishedOn ?? null, data: j.data })),
    );
  });

  /** Re-queue every failed job in a queue, e.g. after fixing a downstream outage. */
  app.post('/queues/:name/retry-failed', async (c) => {
    const queue = queues.get(c.req.param('name'));
    if (!queue) return c.json({ error: 'unknown_queue' }, 404);
    await queue.retryJobs({ state: 'failed' });
    return c.json({ queue: queue.name, retried: true }, 202);
  });

  /** Prometheus scrape endpoint. */
  app.get('/metrics', async (c) => c.text(await renderMetrics(queues), 200, { 'content-type': 'text/plain; version=0.0.4' }));

  /** Queue counts, handy for dashboards and alerts. */
  app.get('/queues', async (c) => {
    const out: Record<string, unknown> = {};
    for (const [name, q] of queues) out[name] = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    return c.json(out);
  });

  return app;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms); }),
  ]);
}
