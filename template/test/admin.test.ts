import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import type { Queue } from 'bullmq';
import { createApp } from '../src/app.js';
import { renderMetrics } from '../src/metrics.js';

function fakeQueue(state = 'failed') {
  const job = { id: '7', attemptsMade: 5, failedReason: 'boom', finishedOn: 1, data: { a: 1 }, getState: vi.fn(async () => state), retry: vi.fn(async () => {}) };
  return {
    job,
    name: 'email',
    getJob: vi.fn(async (id: string) => (id === '7' ? job : undefined)),
    getFailed: vi.fn(async () => [job]),
    retryJobs: vi.fn(async () => {}),
    getJobCounts: vi.fn(async () => ({ waiting: 2, failed: 1 })),
  };
}
const setup = (opts: { state?: string; token?: string } = {}) => {
  const q = fakeQueue(opts.state);
  const app = createApp({
    queues: new Map([['email', q as unknown as Queue]]),
    logger: pino({ level: 'silent' }),
    isShuttingDown: () => false,
    adminToken: opts.token,
  });
  return { app, q };
};

describe('dead-letter + retry', () => {
  it('lists failed jobs with a bounded limit', async () => {
    const { app, q } = setup();
    const res = await app.request('/queues/email/failed?limit=1000');
    expect(res.status).toBe(200);
    expect(q.getFailed).toHaveBeenCalledWith(0, 99);
    expect(await res.json()).toEqual([{ id: '7', attemptsMade: 5, failedReason: 'boom', finishedOn: 1, data: { a: 1 } }]);
    expect((await app.request('/queues/nope/failed')).status).toBe(404);
  });
  it('retries one failed job, 409 if not failed, 404 if missing', async () => {
    const { app, q } = setup();
    expect((await app.request('/jobs/email/7/retry', { method: 'POST' })).status).toBe(202);
    expect(q.job.retry).toHaveBeenCalledWith('failed');
    expect((await app.request('/jobs/email/8/retry', { method: 'POST' })).status).toBe(404);
    expect((await app.request('/jobs/nope/7/retry', { method: 'POST' })).status).toBe(404);
    expect((await setup({ state: 'active' }).app.request('/jobs/email/7/retry', { method: 'POST' })).status).toBe(409);
  });
  it('retries all failed jobs in a queue', async () => {
    const { app, q } = setup();
    expect((await app.request('/queues/email/retry-failed', { method: 'POST' })).status).toBe(202);
    expect(q.retryJobs).toHaveBeenCalledWith({ state: 'failed' });
    expect((await app.request('/queues/nope/retry-failed', { method: 'POST' })).status).toBe(404);
  });
});

describe('metrics', () => {
  it('renders Prometheus text', async () => {
    const { q } = setup();
    const text = await renderMetrics(new Map([['email', q as unknown as Queue]]));
    expect(text).toContain('# TYPE bullmq_jobs gauge');
    expect(text).toContain('bullmq_jobs{queue="email",state="waiting"} 2');
    expect(text).toContain('bullmq_jobs{queue="email",state="active"} 0');
  });
  it('serves /metrics', async () => {
    const res = await setup().app.request('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
  });
});

describe('admin token', () => {
  const token = 'a-very-long-admin-token';
  it('protects admin routes but not health or enqueue', async () => {
    const { app } = setup({ token });
    for (const [path, method] of [['/metrics', 'GET'], ['/queues', 'GET'], ['/queues/email/failed', 'GET'], ['/jobs/email/7/retry', 'POST']] as const) {
      expect((await app.request(path, { method })).status, path).toBe(401);
      expect((await app.request(path, { method, headers: { authorization: `Bearer ${token}` } })).status, path).not.toBe(401);
    }
    expect((await app.request('/health/live')).status).toBe(200);
  });
});
