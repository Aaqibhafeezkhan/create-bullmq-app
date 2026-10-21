import type { Job } from 'bullmq';
import type { ZodType } from 'zod';
import * as email from './email.js';

export interface JobDefinition<P = any> {
  name: string;
  payload: ZodType<P>;
  jobId: (p: P) => string | undefined;
  process: (job: Job<P>) => Promise<unknown>;
}

/** Registry of all queues. Add new job modules here. */
export const jobs: Record<string, JobDefinition> = {
  [email.name]: email,
};
