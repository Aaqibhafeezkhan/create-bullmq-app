import type { Logger } from './logger.js';

export type Closer = { name: string; close: () => Promise<unknown> };

/**
 * Register SIGINT/SIGTERM handlers that run closers in order, with a hard timeout.
 * Returns the shutdown function so tests can call it directly.
 */
export function onShutdown(
  closers: Closer[],
  opts: { logger: Logger; timeoutMs: number; exit?: (code: number) => void; signals?: NodeJS.Signals[] },
) {
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  let started = false;

  const shutdown = async (reason: string): Promise<number> => {
    if (started) return -1;
    started = true;
    opts.logger.info({ reason }, 'shutdown started');
    const timer = setTimeout(() => {
      opts.logger.error({ timeoutMs: opts.timeoutMs }, 'shutdown timed out, forcing exit');
      exit(1);
    }, opts.timeoutMs);
    timer.unref();
    let code = 0;
    for (const c of closers) {
      try {
        await c.close();
        opts.logger.info({ resource: c.name }, 'closed');
      } catch (err) {
        code = 1;
        opts.logger.error({ err, resource: c.name }, 'close failed');
      }
    }
    clearTimeout(timer);
    opts.logger.info({ code }, 'shutdown complete');
    exit(code);
    return code;
  };

  for (const sig of opts.signals ?? (['SIGINT', 'SIGTERM'] as NodeJS.Signals[])) {
    process.once(sig, () => void shutdown(sig));
  }
  return shutdown;
}
