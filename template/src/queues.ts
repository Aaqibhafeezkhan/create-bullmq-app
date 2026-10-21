import { Queue } from 'bullmq';
import type { Config } from './config.js';
import { jobs } from './jobs/index.js';
import { connectionFromUrl } from './lib/redis.js';

export function createQueues(config: Config) {
  const connection = connectionFromUrl(config.REDIS_URL);
  const queues = new Map<string, Queue>();
  for (const name of Object.keys(jobs)) {
    queues.set(
      name,
      new Queue(name, {
        connection,
        prefix: config.QUEUE_PREFIX,
        defaultJobOptions: {
          attempts: config.JOB_ATTEMPTS,
          backoff: { type: 'exponential', delay: config.JOB_BACKOFF_MS },
          // Bound Redis memory: keep recent history only.
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
        },
      }),
    );
  }
  return queues;
}
