import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './lib/logger.js';
import { onShutdown } from './lib/shutdown.js';
import { createQueues } from './queues.js';

const config = loadConfig();
const logger = createLogger(config, 'api');
const queues = createQueues(config);
let draining = false;

const app = createApp({ queues, logger, isShuttingDown: () => draining });
const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => logger.info({ port: info.port }, 'api listening'));

onShutdown(
  [
    { name: 'readiness', close: async () => { draining = true; } },
    { name: 'http', close: () => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))) },
    ...[...queues].map(([name, q]) => ({ name: `queue:${name}`, close: () => q.close() })),
  ],
  { logger, timeoutMs: config.SHUTDOWN_TIMEOUT_MS },
);
