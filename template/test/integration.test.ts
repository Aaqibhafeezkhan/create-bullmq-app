import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { connectionFromUrl } from '../src/lib/redis.js';
import * as email from '../src/jobs/email.js';

// Runs only when a real Redis is available (CI provides one).
const url = process.env.REDIS_URL;

describe.skipIf(!url)('integration (real Redis)', () => {
  const prefix = `test-${Date.now()}`;
  let queue: Queue;
  let events: QueueEvents;
  let worker: Worker;

  beforeAll(async () => {
    queue = new Queue(email.name, { connection: connectionFromUrl(url!), prefix });
    events = new QueueEvents(email.name, { connection: connectionFromUrl(url!, { forWorker: true }), prefix });
    worker = new Worker(email.name, email.process, { connection: connectionFromUrl(url!, { forWorker: true }), prefix });
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady(), worker.waitUntilReady()]);
  });

  afterAll(async () => {
    await worker?.close();
    await queue?.obliterate({ force: true });
    await Promise.all([queue?.close(), events?.close()]);
  });

  it('processes a job end to end', async () => {
    const job = await queue.add(email.name, { to: 'a@b.co', subject: 's', body: 'b' });
    await expect(job.waitUntilFinished(events, 10_000)).resolves.toEqual({ delivered: true, to: 'a@b.co' });
  });

  it('deduplicates by idempotency key', async () => {
    const p = { to: 'a@b.co', subject: 's', body: 'b', idempotencyKey: 'same' };
    const a = await queue.add(email.name, p, { jobId: email.jobId(p) });
    const b = await queue.add(email.name, p, { jobId: email.jobId(p) });
    expect(a.id).toBe(b.id);
  });

  it('worker close drains and stops', async () => {
    await worker.close();
    expect(worker.isRunning()).toBe(false);
  });
});
