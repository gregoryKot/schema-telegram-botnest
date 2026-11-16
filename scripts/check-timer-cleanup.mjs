#!/usr/bin/env node
// Гейт «таймер, меняющий состояние, чистится при размонтировании», по каждому таймеру.
//
// Тост вида `setX(true); setTimeout(() => setX(false), N)` без clearTimeout
// срабатывает после сноса jsdom и роняет весь прогон vitest с `window is not
// defined` при зелёных тестах (CI main, run 36409902702). Тосты сайта — на
// `shared/src/hooks/useTimedFlag.ts`.
//
// В `webapp/src/**`, `shared/src/**` (без тестов и скрытых каталогов) каждый
// `setTimeout`, чей колбэк меняет состояние (сеттер, колбэк-проп, dispatch), держит
// id в переменной или ref и снимает его `clearTimeout` в очистке — разбор в
// timer-cleanup-rules.mjs. Иначе — запись в scripts/timer-cleanup-baseline.json:
// `"<файл>::<функция>::<что меняет>": { "count": N, "reason": "…" }`. Функция —
// ближайшая именованная вокруг таймера (компонент, хук, обработчик), вне функций —
// `(модуль)`; номер строки в ключ не входит, чтобы правка выше его не ломала.
// count — сколько таких таймеров в этой функции. Факт больше записи (второй таймер
// без очистки) — красное; меньше — тоже красное с подсказкой уменьшить, иначе запас
// молча прикрыл бы следующий таймер. Протухшая запись — красное.
// `--update` только переносит записи старого формата `файл::что меняет` и уменьшает
// счёт до факта: новую запись и рост счёта пишет человек с причиной — это решение.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { uncleanedTimers } from './timer-cleanup-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'timer-cleanup-baseline.json');
const SKIP_DIR = new Set(['node_modules', 'dist', 'test-support']);
const TOP = '(модуль)';
const UPDATE_HINT = 'node scripts/check-timer-cleanup.mjs --update';

function walk(rel, acc = []) {
  if (!existsSync(join(ROOT, rel))) return acc;
  for (const name of readdirSync(join(ROOT, rel))) {
    const r = `${rel}/${name}`;
    if (statSync(join(ROOT, r)).isDirectory()) { if (!SKIP_DIR.has(name) && !name.startsWith('.')) walk(r, acc); }
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$|\.d\.ts$|test-helpers/.test(name)) acc.push(r);
  }
  return acc;
}

/** Ключ → строки таймеров без очистки. */
function collect() {
  const flagged = new Map();
  for (const rel of [...walk('webapp/src'), ...walk('shared/src')]) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!raw.includes('setTimeout')) continue;
    for (const { line, fn, change } of uncleanedTimers(raw)) {
      const key = `${rel}::${fn || TOP}::${change}`;
      flagged.set(key, [...(flagged.get(key) ?? []), line]);
    }
  }
  return flagged;
}

/** Ключ старого формата `файл::что меняет` (второй такой — `…#2`). */
const legacyOf = (key) => {
  const bare = key.replace(/#\d+$/, '');
  return bare.split('::').length === 2 ? bare : null;
};
const at = (lines) => `(${lines.map((l) => `L${l}`).join(', ')})`;

function judge(flagged, baseline) {
  const problems = [];
  for (const [key, lines] of flagged) {
    const entry = baseline[key];
    if (!entry) problems.push(`${key} ${at(lines)}: таймер меняет состояние, своей очистки нет`);
    else if (Number.isInteger(entry.count) && lines.length > entry.count)
      problems.push(`${key} ${at(lines)}: таймеров без очистки ${lines.length}, в бейслайне ${entry.count} — новый без очистки`);
  }
  for (const [key, entry] of Object.entries(baseline)) {
    const actual = flagged.get(key)?.length ?? 0;
    if (legacyOf(key)) { problems.push(`бейслайн ${key}: ключ старого формата «файл::что меняет» — перенеси: ${UPDATE_HINT}`); continue; }
    if (!Number.isInteger(entry?.count) || entry.count < 1) problems.push(`бейслайн ${key}: count — целое не меньше 1`);
    else if (actual === 0) problems.push(`бейслайн ${key}: таймера без очистки больше нет — запись протухла`);
    else if (actual < entry.count) problems.push(`бейслайн ${key}: в бейслайне ${entry.count}, без очистки ${actual} — уменьши: ${UPDATE_HINT}`);
    if (String(entry?.reason ?? '').trim().length < 20) problems.push(`бейслайн ${key}: причина короче 20 символов`);
  }
  return problems;
}

/** Бейслайн после --update: старые ключи перенесены, счёт уменьшен до факта, протухшее снято. */
function updated(flagged, baseline) {
  const out = {};
  const legacy = new Map(); // `файл::что меняет` → { left, reason }
  for (const [key, entry] of Object.entries(baseline)) {
    const old = legacyOf(key);
    if (old) {
      const prev = legacy.get(old);
      legacy.set(old, { left: (prev?.left ?? 0) + 1, reason: prev?.reason ?? String(entry) });
      continue;
    }
    const actual = flagged.get(key)?.length ?? 0;
    if (actual > 0) out[key] = { ...entry, count: Math.min(entry.count, actual) };
  }
  for (const [key, lines] of flagged) {
    if (out[key]) continue;
    const [file, , change] = key.split('::');
    const old = legacy.get(`${file}::${change}`);
    if (!old || old.left === 0) continue;
    const count = Math.min(old.left, lines.length);
    old.left -= count;
    out[key] = { count, reason: old.reason };
  }
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}

function main() {
  let baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const flagged = collect();
  if (process.argv.includes('--update')) {
    baseline = updated(flagged, baseline);
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  }
  const problems = judge(flagged, baseline);
  if (problems.length) {
    console.error('❌ Таймер, меняющий состояние, без своей очистки при размонтировании:\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nТаймер, переживший компонент, срабатывает после сноса jsdom и роняет весь vitest\n' +
        '(«window is not defined»). Тост — useTimedFlag (shared/src/hooks/useTimedFlag.ts);\n' +
        'иначе id таймера в ref или переменной и clearTimeout этого id в очистке эффекта.\n' +
        'Осознанное исключение — ключ из списка выше в scripts/timer-cleanup-baseline.json\n' +
        'как { "count": N, "reason": "…" }.',
    );
    process.exit(1);
  }
  const total = [...flagged.values()].reduce((n, lines) => n + lines.length, 0);
  console.log(`✓ таймеры с состоянием: без очистки ${total}, все с причиной в бейслайне.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
