#!/usr/bin/env node
// Гейт «таймер с setState чистится при размонтировании» (docs/open/ci-tests.md).
//
// Тост вида `setX(true); setTimeout(() => setX(false), N)` без clearTimeout
// срабатывает после сноса jsdom и роняет весь прогон vitest с `window is not
// defined` при зелёных тестах (CI main, run 36409902702). Тосты сайта
// переведены на `shared/src/hooks/useTimedFlag.ts`; гейта у класса не было, и
// каждое новое место снова находил красный main.
//
// Файл `webapp/src/**`, `shared/src/**` (без тестов), в котором колбэк
// `setTimeout(…)` зовёт сеттер состояния (`setX(`), обязан чистить таймер —
// упоминать `clearTimeout` (вызов или ссылку: `timers.forEach(clearTimeout)`)
// или брать `useTimedFlag(`. Иначе — запись в
// `scripts/timer-cleanup-baseline.json` («путь» → причина): таймер не
// переживает компонент по построению. Протухшая запись (паттерна больше нет
// или очистка появилась) — красное. Без --update: это решение, не счётчик.
// Граница: проверка пофайловая — один чистый таймер прикрывает соседний.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { matchParen, lineAt } from './gate-balance.mjs';

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

/** Строки, где колбэк setTimeout зовёт сеттер состояния. */
export function stateTimers(rawSrc) {
  const src = stripComments(rawSrc);
  const lines = [];
  for (const m of src.matchAll(/\bsetTimeout\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    if (close !== -1 && /\bset[A-Z]\w*\s*\(/.test(src.slice(open + 1, close))) lines.push(lineAt(src, m.index));
  }
  return { lines, cleaned: /\bclearTimeout\b|\buseTimedFlag\s*\(/.test(src) };
}

function main() {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const flagged = new Map();
  for (const rel of [...walk('webapp/src'), ...walk('shared/src')]) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!raw.includes('setTimeout')) continue;
    const { lines, cleaned } = stateTimers(raw);
    if (lines.length && !cleaned) flagged.set(rel, lines);
  }
  const problems = [];
  for (const [rel, lines] of flagged) {
    if (!(rel in baseline)) problems.push(`${rel} (L${lines.join(', L')}): таймер ставит состояние, clearTimeout нет`);
  }
  for (const [rel, reason] of Object.entries(baseline)) {
    if (!flagged.has(rel)) problems.push(`бейслайн ${rel}: таймера без очистки больше нет — запись протухла`);
    else if (String(reason).trim().length < 20) problems.push(`бейслайн ${rel}: причина короче 20 символов`);
  }
  if (problems.length) {
    console.error('❌ Таймер с setState без очистки при размонтировании:\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nТаймер, переживший компонент, срабатывает после сноса jsdom и роняет весь vitest\n' +
        '(«window is not defined»). Тост — useTimedFlag (shared/src/hooks/useTimedFlag.ts);\n' +
        'иначе id таймера в ref и clearTimeout в очистке эффекта. Таймер не переживает\n' +
        'компонент по построению — запись в scripts/timer-cleanup-baseline.json с причиной.',
    );
    process.exit(1);
  }
  console.log(`✓ таймеры с состоянием: без очистки ${flagged.size} файл(ов), все с причиной в бейслайне.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
