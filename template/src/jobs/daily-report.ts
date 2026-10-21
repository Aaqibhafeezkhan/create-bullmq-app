import { z } from 'zod';
import type { Job } from 'bullmq';

/**
 * Example scheduled (cron) job. The worker registers the schedule with
 * `upsertJobScheduler`, so restarting or scaling workers never creates duplicates.
 */
export const name = 'daily-report';

export const payload = z.object({ kind: z.enum(['daily', 'adhoc']).default('adhoc') });
export type Payload = z.infer<typeof payload>;

export const schedule = { pattern: '0 9 * * *', tz: 'Asia/Kolkata', data: { kind: 'daily' as const } };

export function jobId(): string | undefined {
  return undefined;
}

export async function process(job: Job<Payload>): Promise<{ kind: string; generatedAt: string }> {
  const data = payload.parse(job.data);
  // TODO: build and send your report here.
  return { kind: data.kind, generatedAt: new Date().toISOString() };
}
