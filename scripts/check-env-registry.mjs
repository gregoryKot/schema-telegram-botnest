#!/usr/bin/env node
// Гейт реестра env-переменных (щит, инциденты 2026-09-15/16 — см. заголовок
// src/infra/env-registry.ts). До этого гейта 48+ переменных читались
// напрямую по всему src/** без единого места, что перечисляло бы их —
// каждый новый `process.env.X` мог остаться незадокументированным навсегда.
//
// Гейт — КЛАССИФИКАЦИЯ, не счётчик долга (флага --update нет, тот же принцип,
// что у check-cron-leader.mjs): каждое чтение env-переменной в src/** обязано
// ссылаться на запись реестра (src/infra/env-registry.entries*.ts), и каждая
// запись реестра обязана быть кем-то реально прочитана — иначе она протухла.
//
// Что считается «чтением»:
//   - process.env.NAME / process.env['NAME']
//   - process.env[CONST], где CONST — локальный `const CONST = 'NAME';`
//   - config.get('NAME') / config.getOrThrow<T>('NAME') (ConfigService —
//     обёртка над process.env, ConfigModule.forRoot({isGlobal:true}) без
//     схемы валидации, см. src/app.module.ts)
//   - массив-константа `const X_ENVS = ['A', 'B'];` (тот же приём, что
//     REDIRECT_ENV_VARS в oauth-redirect-config.ts, TOKEN_ENVS в
//     max.provider.ts) — каждый литерал внутри считается прочитанным.
//
// Системные переменные (NODE_ENV/PATH/TZ/HOSTNAME/PORT — приходят от рантайма
// и Node, не от проектной конфигурации) исключены явно, см. SYSTEM_ENV_EXEMPT
// (у списка — тест по правилу №15, check-gate-exemptions.mjs).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const INFRA = join(SRC, 'infra');

// Системные переменные — не проектная конфигурация, регистрировать нечего.
export const SYSTEM_ENV_EXEMPT = ['NODE_ENV', 'PATH', 'TZ', 'HOSTNAME', 'PORT'];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'test-support') continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

const ENV_NAME_RE = /^[A-Z][A-Z0-9_]*$/;

/** Все env-имена, прочитанные в одном файле → Map<name, line первого вхождения>. */
function scanFile(raw) {
  const src = stripComments(raw);
  const used = new Map();
  const add = (name, idx) => {
    if (ENV_NAME_RE.test(name) && !used.has(name)) used.set(name, lineAt(src, idx));
  };

  // Локальные `const NAME = 'VALUE';` — для разрешения process.env[CONST].
  const localConsts = new Map();
  for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*'([A-Z][A-Z0-9_]*)'\s*;/g)) {
    localConsts.set(m[1], m[2]);
  }

  for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) add(m[1], m.index);
  for (const m of src.matchAll(/process\.env\[\s*(['"])([A-Z][A-Z0-9_]*)\1\s*\]/g)) add(m[2], m.index);
  for (const m of src.matchAll(/process\.env\[\s*([A-Za-z_$][\w$]*)\s*\]/g)) {
    const resolved = localConsts.get(m[1]);
    if (resolved) add(resolved, m.index);
  }
  for (const m of src.matchAll(/\.(?:get|getOrThrow)\s*(?:<[^>]*>)?\(\s*(['"])([A-Z][A-Z0-9_]*)\1/g)) {
    add(m[2], m.index);
  }
  // Массив-константа *_ENVS/*_ENV_VARS — каждый литерал внутри = отдельное чтение.
  for (const m of src.matchAll(
    /(?:export\s+)?const\s+[A-Za-z_$][\w$]*(?:_ENVS?|_ENV_VARS)\s*(?::\s*[^=\n]+)?=\s*\[([\s\S]*?)\]/g,
  )) {
    for (const lit of m[1].matchAll(/'([A-Z][A-Z0-9_]*)'|"([A-Z][A-Z0-9_]*)"/g)) {
      add(lit[1] || lit[2], m.index);
    }
  }
  return used;
}

/** Все имена, объявленные `name: 'X'` в env-registry.entries*.ts (регистр-как-данные, без исполнения TS). */
function loadRegistryNames() {
  let files;
  try {
    files = readdirSync(INFRA).filter((f) => /^env-registry\.entries.*\.ts$/.test(f));
  } catch {
    return new Set();
  }
  const names = new Set();
  for (const f of files) {
    const src = readFileSync(join(INFRA, f), 'utf8');
    for (const m of src.matchAll(/\bname:\s*'([A-Z][A-Z0-9_]*)'/g)) names.add(m[1]);
  }
  return names;
}

function main() {
  const found = new Map(); // name -> {file, line}
  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    for (const [name, line] of scanFile(readFileSync(file, 'utf8'))) {
      if (!found.has(name)) found.set(name, { file: rel, line });
    }
  }

  const registry = loadRegistryNames();
  const exempt = new Set(SYSTEM_ENV_EXEMPT);

  const unregistered = [...found.entries()]
    .filter(([name]) => !registry.has(name) && !exempt.has(name))
    .sort(([a], [b]) => a.localeCompare(b));

  const stale = [...registry]
    .filter((name) => !found.has(name))
    .sort((a, b) => a.localeCompare(b));

  const problems = [];
  if (unregistered.length) {
    problems.push(
      'переменные читаются, но не зарегистрированы в src/infra/env-registry.entries*.ts:',
      ...unregistered.map(([name, at]) => `   ${name}  (${at.file}:${at.line})`),
    );
  }
  if (stale.length) {
    problems.push(
      'протухшие записи реестра — переменная нигде не читается (сверься, что произошло):',
      ...stale.map((name) => `   ${name}`),
    );
  }

  if (problems.length) {
    console.error('❌ гейт реестра env-переменных:\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nКаждая читаемая переменная обязана иметь запись в подходящей\n' +
        'src/infra/env-registry.entries.<группа>.ts (name/purpose/requiredInProd/format/group),\n' +
        'а каждая запись реестра — реально читаться где-то в src/** (иначе она протухла и\n' +
        'вводит в заблуждение). Флага --update нет: это классификация решения человека, не счётчик.',
    );
    process.exit(1);
  }

  console.log(
    `✓ гейт реестра env-переменных: ${found.size} переменных прочитано в src/**, ` +
      `${registry.size} записей в реестре, все совпадают (${exempt.size} системных исключены).`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
