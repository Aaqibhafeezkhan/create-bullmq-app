import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { detectPm, scaffold, validName } from '../bin/index.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'cba-'));

test('scaffolds a full project', () => {
  const dir = join(tmp(), 'my-svc');
  scaffold(dir);
  for (const f of ['.gitignore', '.github/workflows/ci.yml', 'Dockerfile', 'docker-compose.yml', 'src/api.ts', 'src/worker.ts', '.env.example']) {
    assert.ok(existsSync(join(dir, f)), f);
  }
  assert.ok(!existsSync(join(dir, '_gitignore')));
  assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name, 'my-svc');
  assert.match(readFileSync(join(dir, 'README.md'), 'utf8'), /^# my-svc/);
});

test('--no-docker and --no-ci remove files', () => {
  const dir = join(tmp(), 'lean');
  scaffold(dir, { docker: false, ci: false });
  assert.ok(!existsSync(join(dir, 'Dockerfile')));
  assert.ok(!existsSync(join(dir, '.github')));
  assert.ok(!existsSync(join(dir, '_github')));
  assert.doesNotMatch(readFileSync(join(dir, 'README.md'), 'utf8'), /docker compose/);
});

test('refuses non-empty directories and bad names', () => {
  const dir = join(tmp(), 'full');
  mkdirSync(dir);
  writeFileSync(join(dir, 'x'), '');
  assert.throws(() => scaffold(dir), /not empty/);
  assert.throws(() => scaffold(join(tmp(), 'Bad Name!')), /valid npm package name/);
});

test('validName and detectPm', () => {
  assert.ok(validName('ok-name'));
  assert.ok(validName('@scope/pkg'));
  assert.ok(!validName('.hidden'));
  assert.equal(detectPm('pnpm/9.0.0 npm/? node/v22'), 'pnpm');
  assert.equal(detectPm('yarn/4'), 'yarn');
  assert.equal(detectPm(''), 'npm');
});

test('CLI end to end with --help and without install', () => {
  const bin = new URL('../bin/index.js', import.meta.url).pathname;
  const help = spawnSync(process.execPath, [bin, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--no-docker/);
  const cwd = tmp();
  const r = spawnSync(process.execPath, [bin, 'svc', '--no-install', '--no-git'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(cwd, 'svc', 'src', 'jobs', 'email.ts')));
  const missing = spawnSync(process.execPath, [bin], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
});
