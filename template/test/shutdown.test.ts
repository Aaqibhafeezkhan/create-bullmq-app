import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { onShutdown } from '../src/lib/shutdown.js';

const logger = pino({ level: 'silent' });

describe('onShutdown', () => {
  it('closes resources in order and exits 0', async () => {
    const order: string[] = [];
    const exit = vi.fn();
    const run = onShutdown(
      [
        { name: 'a', close: async () => { order.push('a'); } },
        { name: 'b', close: async () => { order.push('b'); } },
      ],
      { logger, timeoutMs: 1000, exit, signals: [] },
    );
    await run('test');
    expect(order).toEqual(['a', 'b']);
    expect(exit).toHaveBeenCalledWith(0);
  });
  it('keeps closing after a failure and exits 1', async () => {
    const exit = vi.fn();
    const after = vi.fn(async () => {});
    const run = onShutdown(
      [{ name: 'bad', close: async () => { throw new Error('x'); } }, { name: 'after', close: after }],
      { logger, timeoutMs: 1000, exit, signals: [] },
    );
    await run('test');
    expect(after).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
  it('is idempotent', async () => {
    const exit = vi.fn();
    const run = onShutdown([], { logger, timeoutMs: 1000, exit, signals: [] });
    await run('one');
    expect(await run('two')).toBe(-1);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
