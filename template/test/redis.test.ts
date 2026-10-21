import { describe, expect, it } from 'vitest';
import { connectionFromUrl } from '../src/lib/redis.js';

describe('connectionFromUrl', () => {
  it('parses host, port, auth and db', () => {
    expect(connectionFromUrl('redis://user:p%40ss@cache:6380/2')).toMatchObject({
      host: 'cache', port: 6380, username: 'user', password: 'p@ss', db: 2, maxRetriesPerRequest: 3,
    });
  });
  it('enables TLS for rediss://', () => {
    expect(connectionFromUrl('rediss://h')).toMatchObject({ tls: {}, port: 6379 });
  });
  it('uses blocking-safe settings for workers', () => {
    expect(connectionFromUrl('redis://h', { forWorker: true })).toMatchObject({ maxRetriesPerRequest: null });
  });
  it('rejects other protocols', () => {
    expect(() => connectionFromUrl('http://h')).toThrow(/Unsupported/);
  });
});
