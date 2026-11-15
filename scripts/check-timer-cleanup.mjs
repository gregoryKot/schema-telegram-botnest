#!/usr/bin/env node
// Гейт «таймер, меняющий состояние, чистится при размонтировании», по каждому таймеру.
//
// Тост вида `setX(true); setTimeout(() => setX(false), N)` без clearTimeout
// срабатывает после сноса jsdom и роняет весь прогон vitest с `window is not
// defined` при зелёных тестах (CI main, run 36409902702). Тосты сайта — на
// `shared/src/hooks/useTimedFlag.ts`.
//
// В `webapp/src/**`, `shared/src/**` (без тестов) каждый `setTimeout`, чей колбэк
// меняет состояние (сеттер, колбэк-проп, dispatch), держит id в переменной или ref
// и снимает его `clearTimeout` в очистке — разбор в timer-cleanup-rules.mjs. Иначе —
// запись `"<файл>::<что меняет>": "причина"` в scripts/timer-cleanup-baseline.json.
// Протухшая запись — тоже красное. Без --update: это решение, не счётчик.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { uncleanedTimers } from './timer-cleanup-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'timer-cleanup-baseline.json');
const SKIP_DIR = new Set(['node_modules', 'dist', 'test-support']);

function walk(rel, acc = []) {
  if (!existsSync(join(ROOT, rel))) return acc;
  for (const name of readdirSync(join(ROOT, rel))) {
    const r = `${rel}/${name}`;
    if (statSync(join(ROOT, r)).isDirectory()) { if (!SKIP_DIR.has(name)) walk(r, acc); }
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$|\.d\.ts$|test-helpers/.test(name)) acc.push(r);
  }
  return acc;
}

function main() {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const flagged = new Map();
  for (const rel of [...walk('webapp/src'), ...walk('shared/src')]) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!raw.includes('setTimeout')) continue;
    for (const { line, change } of uncleanedTimers(raw)) {
      const key = `${rel}::${change}`;
      flagged.set(key, [...(flagged.get(key) ?? []), line]);
    }
  }
  const problems = [];
  for (const [key, lines] of flagged) {
    if (!(key in baseline)) problems.push(`${key} (L${lines.join(', L')}): таймер меняет состояние, своей очистки нет`);
  }
  for (const [key, reason] of Object.entries(baseline)) {
    if (!flagged.has(key)) problems.push(`бейслайн ${key}: таймера без очистки больше нет — запись протухла`);
    else if (String(reason).trim().length < 20) problems.push(`бейслайн ${key}: причина короче 20 символов`);
  }
  if (problems.length) {
    console.error('❌ Таймер, меняющий состояние, без своей очистки при размонтировании:\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nТаймер, переживший компонент, срабатывает после сноса jsdom и роняет весь vitest\n' +
        '(«window is not defined»). Тост — useTimedFlag (shared/src/hooks/useTimedFlag.ts);\n' +
        'иначе id таймера в ref или переменной и clearTimeout этого id в очистке эффекта.\n' +
        'Осознанное исключение — "<файл>::<что меняет>" в scripts/timer-cleanup-baseline.json с причиной.',
    );
    process.exit(1);
  }
  console.log(`✓ таймеры с состоянием: без очистки ${flagged.size}, все с причиной в бейслайне.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
