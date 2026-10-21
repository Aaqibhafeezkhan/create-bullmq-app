import pino from 'pino';
import type { Config } from '../config.js';

export function createLogger(config: Pick<Config, 'LOG_LEVEL'>, name: string) {
  return pino({
    name,
    level: config.LOG_LEVEL,
    redact: { paths: ['*.password', '*.token', '*.authorization', 'req.headers.authorization'], censor: '[REDACTED]' },
  });
}
export type Logger = ReturnType<typeof createLogger>;
