import { Redis, type RedisOptions } from 'ioredis';

/** Convert a redis:// or rediss:// URL into BullMQ connection options. */
export function connectionFromUrl(url: string, opts: { forWorker?: boolean } = {}): RedisOptions {
  const u = new URL(url);
  if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') throw new Error(`Unsupported Redis protocol: ${u.protocol}`);
  const db = u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0;
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
    // Workers must block forever on Redis (BullMQ requirement); producers should fail fast instead.
    maxRetriesPerRequest: opts.forWorker ? null : 3,
  };
}

/**
 * BullMQ in native ESM needs a constructed client instead of plain options.
 * Each Queue/Worker/QueueEvents should get its own client.
 */
export function createRedis(url: string, opts: { forWorker?: boolean } = {}): Redis {
  return new Redis(connectionFromUrl(url, opts));
}
