import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig({});
    expect(c.PORT).toBe(3000);
    expect(c.REDIS_URL).toBe('redis://localhost:6379');
    expect(c.WORKER_CONCURRENCY).toBe(5);
  });
  it('coerces numbers', () => {
    expect(loadConfig({ PORT: '8080', JOB_ATTEMPTS: '3' })).toMatchObject({ PORT: 8080, JOB_ATTEMPTS: 3 });
  });
  it('fails fast with readable errors', () => {
    expect(() => loadConfig({ PORT: 'abc', REDIS_URL: 'nope' })).toThrow(/PORT[\s\S]*REDIS_URL|REDIS_URL[\s\S]*PORT/);
  });
});
