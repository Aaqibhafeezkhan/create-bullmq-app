#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'template');
const HELP = `Usage: npm create bullmq-app@latest <dir> [options]

Options:
  --no-docker      skip Dockerfile and docker-compose.yml
  --no-ci          skip the GitHub Actions workflow
  --no-install     do not install dependencies
  --no-git         do not run git init
  --pm <name>      package manager: npm | pnpm | yarn (default: detected)
  -h, --help       show this help
`;

export function validName(name) {
  return /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name) && name.length <= 214;
}

export function detectPm(ua = process.env.npm_config_user_agent ?? '') {
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  return 'npm';
}

/** Copy the template into `target` and apply options. Pure filesystem; no installs. */
export function scaffold(target, opts = {}) {
  const { docker = true, ci = true } = opts;
  const name = basename(resolve(target)).toLowerCase();
  if (!validName(name)) throw new Error(`"${name}" is not a valid npm package name`);
  if (existsSync(target) && readdirSync(target).length > 0) throw new Error(`Directory ${target} is not empty`);

  cpSync(TEMPLATE, target, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist|coverage)([\\/]|$)/.test(src) && !src.endsWith('package-lock.json'),
  });
  renameSync(join(target, '_gitignore'), join(target, '.gitignore'));
  if (ci) renameSync(join(target, '_github'), join(target, '.github'));
  else rmSync(join(target, '_github'), { recursive: true });
  if (!docker) for (const f of ['Dockerfile', 'docker-compose.yml', '.dockerignore']) rmSync(join(target, f));

  for (const f of ['package.json', 'README.md']) {
    const p = join(target, f);
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__APP_NAME__', name));
  }
  if (!docker) {
    const p = join(target, 'README.md');
    writeFileSync(p, readFileSync(p, 'utf8').replace('docker compose up -d redis', 'docker run -d -p 6379:6379 redis:7-alpine'));
  }
  return { name };
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status === 0;
}

function main(argv) {
  // Node 20's parseArgs has no allowNegative, so map --no-<flag> ourselves.
  const toggles = ['docker', 'ci', 'install', 'git'];
  const off = new Set(argv.filter((a) => toggles.some((t) => a === `--no-${t}`)).map((a) => a.slice(5)));
  const { values, positionals } = parseArgs({
    args: argv.filter((a) => !toggles.some((t) => a === `--no-${t}`)),
    allowPositionals: true,
    options: {
      pm: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  for (const t of toggles) values[t] = !off.has(t);
  if (values.help) return void process.stdout.write(HELP);
  const dir = positionals[0];
  if (!dir) {
    process.stderr.write(HELP);
    process.exitCode = 1;
    return;
  }
  const pm = values.pm ?? detectPm();
  if (!['npm', 'pnpm', 'yarn'].includes(pm)) throw new Error(`Unknown package manager: ${pm}`);

  const target = resolve(dir);
  const { name } = scaffold(target, values);
  console.log(`\n✔ Created ${name} in ${target}`);

  if (values.git) run('git', ['init', '-q'], target);
  if (values.install) {
    console.log(`\nInstalling dependencies with ${pm}...`);
    if (!run(pm, ['install'], target)) console.warn(`\n⚠ Install failed. Run "${pm} install" yourself.`);
  }
  const r = pm === 'npm' ? 'npm run' : pm;
  console.log(`\nNext steps:
  cd ${dir}
  cp .env.example .env${values.docker ? '\n  docker compose up -d redis' : ''}${values.install ? '' : `\n  ${pm} install`}
  ${r} dev:api      # in one terminal
  ${r} dev:worker   # in another
`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exitCode = 1;
  }
}
