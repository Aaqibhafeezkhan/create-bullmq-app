import { createServer } from 'node:http';
import { Worker } from 'bullmq';
import { loadConfig } from './config.js';
import { jobs } from './jobs/index.js';
import { createLogger } from './lib/logger.js';
import { connectionFromUrl } from './lib/redis.js';
import { onShutdown } from './lib/shutdown.js';

const config = loadConfig();
const logger = createLogger(config, 'worker');
const connection = connectionFromUrl(config.REDIS_URL, { forWorker: true });

const workers = Object.values(jobs).map((def) => {
  const w = new Worker(def.name, def.process, {
    connection,
    prefix: config.QUEUE_PREFIX,
    concurrency: config.WORKER_CONCURRENCY,
  });
  w.on('completed', (job) => logger.info({ queue: def.name, jobId: job.id }, 'job completed'));
  w.on('failed', (job, err) =>
    logger.warn({ queue: def.name, jobId: job?.id, attempt: job?.attemptsMade, err: err.message }, 'job failed'),
  );
  w.on('stalled', (jobId) => logger.warn({ queue: def.name, jobId }, 'job stalled'));
  w.on('error', (err) => logger.error({ queue: def.name, err }, 'worker error'));
  return w;
});

// Tiny health server so orchestrators can probe the worker too.
let draining = false;
const health = createServer((req, res) => {
  const ok = req.url === '/health/live' || (req.url === '/health/ready' && !draining && workers.every((w) => w.isRunning()));
  res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ status: ok ? 'ok' : 'unavailable' }));
});
health.listen(config.WORKER_HEALTH_PORT, () => logger.info({ port: config.WORKER_HEALTH_PORT, queues: Object.keys(jobs) }, 'worker started'));

onShutdown(
  [
    { name: 'readiness', close: async () => { draining = true; } },
    // close() stops fetching new jobs and waits for active ones to finish.
    ...workers.map((w) => ({ name: `worker:${w.name}`, close: () => w.close() })),
    { name: 'health', close: () => new Promise<void>((r) => health.close(() => r())) },
  ],
  { logger, timeoutMs: config.SHUTDOWN_TIMEOUT_MS },
);
