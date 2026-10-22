import type { Job } from 'bullmq';
import type { ZodType } from 'zod';
import * as email from './email.js';
import * as dailyReport from './daily-report.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- definitions with different payloads share one registry
export interface JobDefinition<P = any> {
  name: string;
  payload: ZodType<P>;
  jobId: (p: P) => string | undefined;
  process: (job: Job<P>) => Promise<unknown>;
  /** Run on a schedule (cron `pattern` or `every` ms). The worker upserts it on start, so it is never duplicated. */
  schedule?: { pattern?: string; every?: number; tz?: string; data: P };
  /** Rate limit for this queue across all workers, e.g. `{ max: 10, duration: 1000 }` = 10 jobs/s. */
  limiter?: { max: number; duration: number };
  /** Per-queue concurrency; defaults to WORKER_CONCURRENCY. */
  concurrency?: number;
}

/** Registry of all queues. `npm run new:queue <name>` adds new job modules here. */
export const jobs: Record<string, JobDefinition> = {
  [email.name]: email,
  [dailyReport.name]: dailyReport,
  // new-queue:register
};
