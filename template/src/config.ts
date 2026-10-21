import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  QUEUE_PREFIX: z.string().min(1).default('app'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(1000).default(5),
  JOB_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(5),
  JOB_BACKOFF_MS: z.coerce.number().int().min(0).default(2000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(25000),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export type Config = z.infer<typeof EnvSchema>;

/** Parse and validate env. Fails fast with a readable list of problems. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
