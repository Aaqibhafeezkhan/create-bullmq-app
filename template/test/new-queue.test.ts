import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/new-queue.mjs');

describe('npm run new:queue', () => {
  it('creates and registers a job module', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nq-'));
    cpSync('src', join(dir, 'src'), { recursive: true });
    const r = spawnSync(process.execPath, [script, 'resize-image'], { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(dir, 'src/jobs/resize-image.ts'))).toBe(true);
    const index = readFileSync(join(dir, 'src/jobs/index.ts'), 'utf8');
    expect(index).toContain("import * as resizeImage from './resize-image.js';");
    expect(index).toContain('[resizeImage.name]: resizeImage,');
    expect(spawnSync(process.execPath, [script, 'resize-image'], { cwd: dir }).status).toBe(1);
    expect(spawnSync(process.execPath, [script, 'Bad Name'], { cwd: dir }).status).toBe(1);
  });
});
