import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { detectPm, prompt, scaffold, validName } from '../bin/index.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'cba-'));

test('scaffolds a full project', () => {
  const dir = join(tmp(), 'my-svc');
  scaffold(dir);
  for (const f of ['.gitignore', '.github/workflows/ci.yml', 'Dockerfile', 'docker-compose.yml', 'src/api.ts', 'src/worker.ts', '.env.example']) {
    assert.ok(existsSync(join(dir, f)), f);
  }
  assert.ok(!existsSync(join(dir, '_gitignore')));
  assert.equal(JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8')).name, 'my-svc');
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
  const bin = fileURLToPath(new URL('../bin/index.js', import.meta.url));
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

test('interactive prompt uses answers and defaults', async () => {
  const answers = ['Bad Name!', 'svc-a', 'n', '', 'no', 'y'];
  const asked = [];
  const r = await prompt(async (q) => (asked.push(q), answers.shift()));
  assert.deepEqual(r, { dir: 'svc-a', docker: false, ci: true, install: false, git: true });
  assert.equal(asked.length, 6);
  const d = await prompt(async () => '', { dir: 'x', docker: false });
  assert.deepEqual(d, { dir: 'x', docker: false, ci: true, install: true, git: true });
});

test('--yes without a dir uses the default name', () => {
  const bin = fileURLToPath(new URL('../bin/index.js', import.meta.url));
  const cwd = tmp();
  const r = spawnSync(process.execPath, [bin, '-y', '--no-install', '--no-git'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(cwd, 'my-bullmq-app', 'scripts', 'new-queue.mjs')));
  assert.match(r.stdout, /new:queue/);
});

test('runs when invoked through a symlink (npx / node_modules/.bin)', () => {
  const bin = fileURLToPath(new URL('../bin/index.js', import.meta.url));
  const cwd = tmp();
  const link = join(cwd, 'create-bullmq-app');
  symlinkSync(bin, link);
  const r = spawnSync(process.execPath, [link, 'svc', '--no-install', '--no-git'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(cwd, 'svc', 'package.json')));
});

test('detectPm recognises bun', () => {
  assert.equal(detectPm('bun/1.2.0 npm/? node/v22.6.0 linux x64'), 'bun');
});

test('new:queue accepts the name after a literal "--" (pnpm/yarn pass it through)', () => {
  const dir = join(tmp(), 'q-svc');
  scaffold(dir);
  const script = join(dir, 'scripts', 'new-queue.mjs');
  const r = spawnSync(process.execPath, [script, '--', 'resize-image'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'src', 'jobs', 'resize-image.ts')));
});

for (const pm of ['pnpm', 'yarn', 'bun']) {
  test(`scaffold for ${pm}: no npm lockfile and CI uses ${pm}`, () => {
    const dir = join(tmp(), `svc-${pm}`);
    scaffold(dir, { pm });
    assert.ok(!existsSync(join(dir, 'package-lock.json')));
    const ci = readFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'utf8');
    assert.doesNotMatch(ci, /npm ci/);
    assert.match(ci, new RegExp(`${pm} (run )?typecheck`));
    if (pm === 'bun') assert.match(ci, /oven-sh\/setup-bun/);
    if (pm === 'pnpm') assert.match(ci, /pnpm\/action-setup/);
  });
}

test('scaffold for npm keeps the pinned lockfile and npm ci', () => {
  const dir = join(tmp(), 'svc-npm');
  scaffold(dir, { pm: 'npm' });
  assert.ok(existsSync(join(dir, 'package-lock.json')));
  assert.match(readFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'utf8'), /npm ci/);
});

test('--pm bun is accepted on the CLI and next steps use bun', () => {
  const bin = fileURLToPath(new URL('../bin/index.js', import.meta.url));
  const cwd = tmp();
  const r = spawnSync(process.execPath, [bin, 'bsvc', '--no-install', '--no-git', '--pm', 'bun'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /bun run dev:api/);
  assert.match(r.stdout, /bun run new:queue <name>/);
});

test('generated project lints with the eslint-plugin-bullmq preset in CI', () => {
  const dir = join(tmp(), 'lint-svc');
  scaffold(dir);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.lint, 'eslint .');
  assert.ok(pkg.devDependencies['eslint-plugin-bullmq']);
  assert.match(readFileSync(join(dir, 'eslint.config.js'), 'utf8'), /bullmq\.configs\.recommended/);
  assert.match(readFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'utf8'), /npm run lint/);
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'));
  assert.ok(lock.packages['node_modules/eslint-plugin-bullmq'], 'lockfile pins the plugin');
});
