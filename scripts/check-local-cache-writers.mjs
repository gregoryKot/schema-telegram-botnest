#!/usr/bin/env node
// Гейт «один ключ localStorage — один писатель» для фронтенда (webapp/src,
// shared/src).
//
// Класс инцидента 2026-11-05 (PR #935): кэш контакта терапевта
// (`therapy_contact_*`) писали старт приложения и вход по ссылке, а экран
// «Мой терапевт» менял связь на сервере и кэш не трогал — после отключения
// до перезагрузки висело «Написать терапевту» бывшему терапевту. Общее имя
// класса — «кэш пережил источник правды»: состояние сервера меняется в одном
// месте, его локальная копия обновляется в другом, и ничто не требует, чтобы
// это было одно и то же место. Механизм: у каждого ключа ровно один
// модуль-владелец, который единственный зовёт `localStorage.setItem` /
// `removeItem` с этим ключом; остальные идут через его экспортированную
// функцию — тогда «обновить кэш там, где меняется источник» сводится к
// одному вызову, и второй писатель краснеет в CI раньше, чем расходится.
//
// Гейт не ищет признак («похоже на кэш сервера»), а ТРЕБУЕТ классификации
// каждого найденного ключа в scripts/local-cache-baseline.json (тот же приём,
// что у check-cron-leader.mjs): ключ без записи, запись без ключа (протухла),
// второй писатель, владелец, который сам не пишет, — всё красное. Флага
// --update нет: это решение человека, а не счётчик долга.
//
// Что считается записью:
//   1. прямой `localStorage.setItem(<ключ>, …)` / `removeItem(<ключ>)`;
//   2. вызов функции-движка (раздел "engines" реестра: safeLocalStorage,
//      stringArrayStorage, drafts и т.п.) — ключ берётся из первого аргумента
//      (`fn`), из N-го (`fn#1`) или из поля объекта (`fn#prop`); пишущим
//      считается ВЫЗЫВАЮЩИЙ файл.
// Ключ разрешается статически (local-cache-resolve.mjs): литерал, константа,
// импорт, поле объекта, функция-строитель; динамическое семейство пишется
// в реестр как `prefix*`. Неразрешимый ключ в обычном файле — красное; в
// файле-движке — норма (ключ приходит от вызывающего, и тот уже проверен).
// Движок без единого неразрешимого места — протухшая запись, тоже красное.
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  importMap,
  makeContext,
  matchBracket,
  resolveKeyExpr,
  splitTopLevel,
} from './local-cache-resolve.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'local-cache-baseline.json');
const SCAN_DIRS = ['webapp/src', 'shared/src'];
const KINDS = ['mirror', 'local'];
const TEST_FILE = /\.(spec|test)\.(ts|tsx)$|\.test-helpers\.|\/test-support\/|\.d\.ts$/;

function walk(dir, acc = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return acc;
  for (const name of readdirSync(abs)) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist') walk(rel, acc);
    } else if (/\.(ts|tsx)$/.test(name) && !TEST_FILE.test(rel)) acc.push(rel);
  }
  return acc;
}

function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}

/** Аргумент-ключ вызова, чья `(` стоит в parenIndex: позиционный (where —
 * число, по умолчанию 0) или поле объекта-аргумента (where — имя поля). */
function keyArgument(src, parenIndex, where) {
  const close = matchBracket(src, parenIndex);
  if (close === -1) return null;
  const args = splitTopLevel(src.slice(parenIndex + 1, close), ',');
  if (!where || /^\d+$/.test(where)) return args[Number(where ?? 0)] ?? null;
  const prop = where;
  const obj = args.find((a) => a.startsWith('{'));
  if (!obj) return null;
  const end = matchBracket(obj, 0);
  for (const entry of splitTopLevel(obj.slice(1, end), ',')) {
    const colon = entry.search(/:(?!:)/);
    const name = (colon === -1 ? entry : entry.slice(0, colon)).trim();
    if (name === prop) return colon === -1 ? name : entry.slice(colon + 1).trim();
  }
  return null;
}

/** Все места записи в файле: прямые вызовы localStorage + вызовы движков. */
function collectWrites(rel, ctx, engineFns) {
  const abs = join(ROOT, rel);
  const src = ctx.load(abs);
  const sites = [];
  const direct = /(?:^|[^\w$.])(?:window\.)?localStorage\s*\.\s*(?:setItem|removeItem)\s*\(/g;
  let m;
  while ((m = direct.exec(src))) sites.push({ paren: m.index + m[0].length - 1, prop: null });
  const imports = importMap(abs, src);
  for (const { file, fn, prop } of engineFns) {
    const local = file === abs ? fn : [...imports].find(([, v]) => v.file === file && v.name === fn)?.[0];
    if (!local) continue;
    const call = new RegExp(`(^|[^\\w$.])${local}\\s*(?:<[^(]*>)?\\s*\\(`, 'g');
    while ((m = call.exec(src))) {
      const before = src.slice(Math.max(0, m.index - 12), m.index + m[1].length);
      if (/function\s*$/.test(before)) continue;
      sites.push({ paren: m.index + m[0].length - 1, prop });
    }
  }
  return sites.map(({ paren, prop }) => {
    const line = lineAt(src, paren);
    const arg = keyArgument(src, paren, prop);
    if (arg === null) return { line, error: 'не найден аргумент-ключ' };
    const res = resolveKeyExpr(arg, abs, ctx);
    return res.error ? { line, error: `${res.error} (${arg.slice(0, 50)})` } : { line, keys: res.keys };
  });
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет реестра — scripts/local-cache-baseline.json обязан существовать\n' +
        '(флага --update нет: классификация вносится руками, см. CLAUDE.md).',
    );
    process.exit(1);
    return {};
  }
}

function fnDefined(src, name) {
  return new RegExp(`(?:^|[^\\w$.])(?:function\\s+${name}\\s*(?:<[^(]*>)?\\s*\\(|(?:const|let)\\s+${name}\\s*(?::[^=]+)?=)`, 'm').test(src);
}

function main() {
  const baseline = loadBaseline();
  const keys = baseline.keys ?? {};
  const engines = baseline.engines ?? {};
  const ctx = makeContext(ROOT);
  const problems = [];

  const engineFns = [];
  for (const [rel, entry] of Object.entries(engines)) {
    const src = ctx.load(join(ROOT, rel));
    if (src === null) { problems.push(`движок ${rel}: файла нет (протухшая запись)`); continue; }
    if (String(entry?.reason ?? '').trim().length < 20) problems.push(`движок ${rel}: причина короче 20 символов`);
    for (const spec of entry?.functions ?? []) {
      const [fn, prop] = String(spec).split('#');
      if (!fnDefined(src, fn)) problems.push(`движок ${rel}: функция ${fn} в файле не объявлена`);
      else engineFns.push({ file: join(ROOT, rel), fn, prop: prop ?? null });
    }
  }

  const writers = new Map(); // key → Map(file → line)
  const unresolvedByEngine = new Map();
  for (const rel of SCAN_DIRS.flatMap((d) => walk(d))) {
    for (const site of collectWrites(rel, ctx, engineFns)) {
      if (site.error) {
        if (rel in engines) unresolvedByEngine.set(rel, (unresolvedByEngine.get(rel) ?? 0) + 1);
        else problems.push(`${rel}:${site.line}: ключ не разрешается статически — ${site.error}`);
        continue;
      }
      for (const key of site.keys) {
        if (!writers.has(key)) writers.set(key, new Map());
        if (!writers.get(key).has(rel)) writers.get(key).set(rel, site.line);
      }
    }
  }
  for (const rel of Object.keys(engines)) {
    if (!unresolvedByEngine.has(rel)) problems.push(`движок ${rel}: ни одной записи с ключом от вызывающего — запись протухла`);
  }

  for (const [key, entry] of Object.entries(keys)) {
    const owner = entry?.owner;
    if (!KINDS.includes(entry?.kind)) problems.push(`${key}: kind «${entry?.kind}» (допустимо mirror|local)`);
    if (entry?.kind === 'mirror' && String(entry?.source ?? '').trim().length < 10) {
      problems.push(`${key}: mirror без source — назови серверное состояние, копией которого служит ключ`);
    }
    const w = writers.get(key);
    if (!w) { problems.push(`${key}: протухшая запись — в коде ключ никто не пишет (владелец ${owner})`); continue; }
    if (!w.has(owner)) problems.push(`${key}: владелец ${owner} сам не пишет ключ; пишут: ${[...w.keys()].join(', ')}`);
    for (const [file, line] of w) {
      if (file !== owner) problems.push(`${key}: второй писатель ${file}:${line} (владелец ${owner}) — зови его функцию`);
    }
  }
  for (const [key, w] of writers) {
    if (key in keys) continue;
    problems.push(`${key}: ключ без записи в реестре; пишут: ${[...w].map(([f, l]) => `${f}:${l}`).join(', ')}`);
  }

  if (problems.length) {
    console.error('❌ Гейт «один ключ localStorage — один писатель» (CLAUDE.md, фронтенд):\n');
    for (const p of problems.sort()) console.error('   ' + p);
    console.error(
      '\nКэш, у которого два писателя, переживает источник правды (инцидент\n' +
        '2026-11-05, PR #935). Для каждого ключа в scripts/local-cache-baseline.json:\n' +
        '  "keys": { "<ключ>": { "owner": "<файл>", "kind": "mirror"|"local", "source": "<что на сервере>" } }\n' +
        'владелец единственный зовёт localStorage.setItem/removeItem с этим ключом,\n' +
        'остальные — его экспортированную функцию. Динамическое семейство — "prefix*".\n' +
        'Обёртка, получающая ключ параметром: "engines": { "<файл>": { "functions": ["fn", "fn#1", "fn#prop"], "reason": "…" } }.\n' +
        'Флага --update нет — это классификация решения человека, не счётчик.',
    );
    process.exit(1);
  }
  console.log(
    `✓ гейт владельцев кэша localStorage: ${writers.size} ключей, ${Object.keys(engines).length} движков, у каждого ключа один писатель.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
