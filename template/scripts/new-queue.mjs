#!/usr/bin/env node
// Usage: npm run new:queue -- <name>   (e.g. npm run new:queue -- resize-image)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// pnpm and yarn forward a literal `--` to the script, so skip it.
const name = process.argv.slice(2).find((a) => a !== '--');
if (!name || !/^[a-z][a-z0-9-]{0,62}$/.test(name)) {
  console.error('Usage: npm run new:queue -- <name>   (lowercase letters, digits and dashes)');
  process.exit(1);
}
const dir = join(process.cwd(), 'src', 'jobs');
const file = join(dir, `${name}.ts`);
if (existsSync(file)) {
  console.error(`src/jobs/${name}.ts already exists`);
  process.exit(1);
}
const ident = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

writeFileSync(
  file,
  `import { z } from 'zod';
import type { Job } from 'bullmq';

export const name = '${name}';

export const payload = z.object({
  // TODO: describe the job input
  id: z.string().min(1),
});
export type Payload = z.infer<typeof payload>;

/** Same id = same job, so client retries never enqueue twice. Return undefined to allow duplicates. */
export function jobId(p: Payload): string | undefined {
  return \`\${name}-\${p.id}\`;
}

export async function process(job: Job<Payload>): Promise<unknown> {
  const data = payload.parse(job.data);
  // TODO: do the work. Throwing retries with exponential backoff.
  return { ok: true, id: data.id };
}
`,
);

const indexPath = join(dir, 'index.ts');
let index = readFileSync(indexPath, 'utf8');
const marker = '  // new-queue:register';
if (!index.includes(marker)) {
  console.error('Could not find the "// new-queue:register" marker in src/jobs/index.ts; register the job by hand.');
  process.exit(1);
}
const lastImport = index.lastIndexOf("from './");
const eol = index.indexOf('\n', lastImport);
index = `${index.slice(0, eol + 1)}import * as ${ident} from './${name}.js';\n${index.slice(eol + 1)}`;
index = index.replace(marker, `  [${ident}.name]: ${ident},\n${marker}`);
writeFileSync(indexPath, index);
console.log(`✔ Created src/jobs/${name}.ts and registered it.
  POST /jobs/${name} now enqueues, and the worker processes it.`);
