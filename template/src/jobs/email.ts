import { z } from 'zod';
import type { Job } from 'bullmq';

/**
 * Example job. Copy this file to add a new queue: a name, a payload schema,
 * an idempotency key and a processor. Everything else is wired generically.
 */
export const name = 'email';

export const payload = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  /** Optional client-supplied key; same key = same job (dedupe on retries). BullMQ ids cannot contain ":". */
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/, 'use 1-128 chars of A-Z a-z 0-9 _ . -').optional(),
});
export type Payload = z.infer<typeof payload>;

/** Most email providers rate-limit you; BullMQ enforces this across every worker process. */
export const limiter = { max: 10, duration: 1000 };

export function jobId(p: Payload): string | undefined {
  return p.idempotencyKey ? `${name}-${p.idempotencyKey}` : undefined;
}

export async function process(job: Job<Payload>): Promise<{ delivered: true; to: string }> {
  const data = payload.parse(job.data); // never trust what is in Redis
  await job.updateProgress(50);
  // TODO: call your email provider here. Throwing triggers retry with backoff.
  await job.updateProgress(100);
  return { delivered: true, to: data.to };
}
