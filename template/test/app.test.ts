import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import type { Queue } from 'bullmq';
import { createApp } from '../src/app.js';

function fakeQueue() {
  return {
    add: vi.fn(async (_n: string, _d: unknown, opts?: { jobId?: string }) => ({ id: opts?.jobId ?? '1' })),
    getJob: vi.fn(async () => undefined),
    getJobCounts: vi.fn(async () => ({ waiting: 0 })),
  } as unknown as Queue & { add: ReturnType<typeof vi.fn> };
}

function setup(shuttingDown = false) {
  const q = fakeQueue();
  const app = createApp({ queues: new Map([['email', q]]), logger: pino({ level: 'silent' }), isShuttingDown: () => shuttingDown });
  return { app, q };
}
const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('api', () => {
  it('liveness is always ok', async () => {
    expect((await setup(true).app.request('/health/live')).status).toBe(200);
  });
  it('readiness reports draining', async () => {
    expect((await setup(true).app.request('/health/ready')).status).toBe(503);
    expect((await setup(false).app.request('/health/ready')).status).toBe(200);
  });
  it('enqueues valid jobs with 202', async () => {
    const { app, q } = setup();
    const res = await app.request('/jobs/email', post({ to: 'a@b.co', subject: 'hi', body: 'x' }));
    expect(res.status).toBe(202);
    expect(q.add).toHaveBeenCalledOnce();
  });
  it('uses idempotency key as jobId', async () => {
    const { app } = setup();
    const res = await app.request('/jobs/email', post({ to: 'a@b.co', subject: 'hi', body: 'x', idempotencyKey: 'k1' }));
    expect(await res.json()).toEqual({ id: 'email-k1', queue: 'email' });
  });
  it('rejects invalid payloads with 422', async () => {
    expect((await setup().app.request('/jobs/email', post({ to: 'nope' }))).status).toBe(422);
  });
  it('rejects bad json with 400 and unknown queues with 404', async () => {
    const { app } = setup();
    expect((await app.request('/jobs/email', { method: 'POST', body: '{' })).status).toBe(400);
    expect((await app.request('/jobs/nope', post({}))).status).toBe(404);
  });
  it('returns 404 for missing jobs', async () => {
    expect((await setup().app.request('/jobs/email/123')).status).toBe(404);
  });
});

describe('idempotency key validation', () => {
  it('rejects keys BullMQ cannot store', async () => {
    const res = await setup().app.request('/jobs/email', post({ to: 'a@b.co', subject: 'hi', body: 'x', idempotencyKey: 'a:b' }));
    expect(res.status).toBe(422);
  });
});
