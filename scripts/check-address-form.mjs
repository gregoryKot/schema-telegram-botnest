#!/usr/bin/env node
// Храповик ты/вы (аудит 2026-07, этап 3б; правило CLAUDE.md «Обращение ты/вы»).
// Жёсткие «ты»-строки без tr() просачивались в один из фронтендов (3+
// рассинхрона) — точная детекция невозможна статически, поэтому храповик:
// считаем подозрительные вхождения (ты/тебя/тебе/тобой/твой… вне tr(/t(/
// pickForm( и вне маркетинговых страниц) и сравниваем с бейслайном. Снижение —
// node scripts/check-address-form.mjs --update.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'address-form-baseline.json');
const UPDATE = process.argv.includes('--update');

const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];
// Экспорт ради структурной проверки в address-form.spec.ts (приём ALLOW из
// check-gendered-forms.mjs): у каждого исключения — образец, который оно ловит.
export const EXCLUDE = [
  /webapp\/src\/pages\/(LandingPage|ProductLandingPage|ArticlesPage|GamePage|ReviewsPage|articleDiagrams)/,
  /\.test\.(ts|tsx)$/,
  /\.d\.ts$/,
];
// Формы 2 л. ед.ч. Слова с большой буквы в середине строки — тоже (начало
// предложения в тексте кнопки).
// ВАЖНО: \b в JS — ASCII-only и кириллицу не видит, поэтому границы слова —
// через lookaround по буквам.
const TY_RE =
  /(?<![А-Яа-яЁёA-Za-z])([Тт]ы|[Тт]ебя|[Тт]ебе|[Тт]обой|[Тт]во(?:й|я|ё|е|и|их|им|ей|ю))(?![А-Яа-яЁё])/g;
// Вхождение легитимно, если оно внутри аргументов вилки tr(...)/pickForm(...)/
// t(...). Вилки бывают многострочными (prettier переносит аргументы), поэтому
// построчная проверка не годится: вырезаем аргументы целиком, балансируя
// скобки и не считая скобки внутри строковых литералов.
const FORK_OPEN_RE = /(?<![\p{L}\p{N}_$.])(tr|pickForm|t)\(/gu;

function blankForkArgs(src) {
  let out = '';
  let last = 0;
  FORK_OPEN_RE.lastIndex = 0;
  let m;
  while ((m = FORK_OPEN_RE.exec(src)) !== null) {
    const argStart = m.index + m[0].length;
    if (argStart <= last) continue; // вложенная вилка внутри уже вырезанной
    let depth = 1;
    let quote = null; // ' " ` или null
    let i = argStart;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    out += src.slice(last, argStart);
    // Переводы строк сохраняем — номера строк в диагностике не съезжают.
    out += src.slice(argStart, i).replace(/[^\n]/g, ' ');
    last = i;
    FORK_OPEN_RE.lastIndex = i;
  }
  return out + src.slice(last);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(p)) yield p;
  }
}

// CLI-логика — только при запуске как скрипт (не при импорте EXCLUDE).
function main() {
const counts = {};
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (EXCLUDE.some((re) => re.test(rel))) continue;
    let n = 0;
    for (const line of blankForkArgs(readFileSync(file, 'utf8')).split('\n')) {
      const code = line.replace(/\/\/.*$/, ''); // строчные комментарии не считаем
      const m = code.match(TY_RE);
      if (m) n += m.length;
    }
    if (n > 0) counts[rel] = n;
  }
}

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Бейслайн обновлён: ${Object.keys(counts).length} файлов, ${total} вхождений.`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('Нет бейслайна — сгенерируй: node scripts/check-address-form.mjs --update');
  process.exit(1);
}

const regressions = [];
for (const [file, n] of Object.entries(counts)) {
  const base = baseline[file] ?? 0;
  if (n > base) regressions.push(`${file}: ${base} → ${n}`);
}

if (regressions.length > 0) {
  console.error('❌ Новые жёсткие «ты»-формы без tr() (правило CLAUDE.md):');
  for (const r of regressions) console.error('   ' + r);
  console.error(
    'Оберни строку в tr("ты-вариант", "вы-вариант") или, если вхождение\n' +
      'осознанно нейтральное (цитата, «ты»-форма внутри tr на соседней строке),\n' +
      'обнови бейслайн: node scripts/check-address-form.mjs --update',
  );
  process.exit(1);
}
console.log('✓ ты/вы-храповик: без регрессий');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
