#!/usr/bin/env node
// Гейт: новый эндпоинт = DTO с class-validator (правило №6 CLAUDE.md).
//
// Что происходит без гейта. `ValidationPipe({ whitelist: true })` работает
// через `class-transformer`/`class-validator` — оба смотрят на РЕФЛЕКСИЮ
// класса (декораторы полей). У `interface`/`type`/`Record<...>` в рантайме
// этой информации нет вообще (TypeScript стирает её при компиляции), поэтому
// Nest молча пропускает тело запроса как есть, БЕЗ единой проверки. `@Body()
// dto: SomeInterface` выглядит типобезопасно на экране редактора и не
// проверяется никак в проде — компиляторная иллюзия.
//
// Найдено аудитом: 8 таких мест, включая ДВА публичных денежных эндпоинта —
// `POST /api/donation` и `POST /api/subscription` — принимающих произвольное
// тело без единой рантайм-проверки суммы/типа/полей.
//
// Проверяется только НЕКЛЮЧЕВАННЫЙ `@Body() name: Type` — `@Body('field')`
// вне области действия правила (это уже не DTO целиком, а один примитив).
//
//   node scripts/check-body-dto.mjs            # проверка
//   node scripts/check-body-dto.mjs --update    # зафиксировать бейслайн
//   node scripts/check-body-dto.mjs --verbose   # что именно найдено, file:line
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'body-dto-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const allTsFiles = walk(SRC);
const controllerFiles = allTsFiles.filter((f) => f.endsWith('.controller.ts'));

// ── 1. Реестр всех `class <Name>` под src/ ──────────────────────────────────
// DTO — это класс. Регекс по объявлениям, как и в остальных гейтах
// (check-route-collisions.mjs, check-dead-files.mjs) — полноценный
// TS-парсер тут избыточен, а `class Foo` синтаксически однозначен.
const classNames = new Set();
for (const file of allTsFiles) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\bclass\s+(\w+)/g)) classNames.add(m[1]);
}

// Достаёт тип параметра после `name:` — сканирует посимвольно, чтобы верно
// остановиться на запятой/скобке ВНЕ `<...>` (иначе `Record<string, number>`
// обрежется на внутренней запятой).
function readType(text, start) {
  let depth = 0;
  let i = start;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '<') depth++;
    else if (c === '>') depth--;
    else if (depth === 0 && (c === ',' || c === ')')) break;
  }
  return { type: text.slice(start, i).trim(), end: i };
}

// Только НЕКЛЮЧЕВАННЫЙ `@Body() name: Type` — `@Body('field')` содержит
// символ `'` между скобками и не совпадёт с `@Body\(\)`.
const BODY_RE = /@Body\(\)\s*(\w+)\s*:\s*/g;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

const violations = []; // { key, file, type, line }
let totalUnkeyed = 0;
let totalOk = 0;

for (const file of controllerFiles) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  BODY_RE.lastIndex = 0;
  for (let m = BODY_RE.exec(text); m; m = BODY_RE.exec(text)) {
    totalUnkeyed++;
    const { type } = readType(text, m.index + m[0].length);
    const line = lineOf(text, m.index);
    const simpleName = /^\w+$/.test(type) ? type : null;
    const isClass = simpleName !== null && classNames.has(simpleName);
    if (isClass) {
      totalOk++;
      continue;
    }
    const label = simpleName ?? type;
    violations.push({ key: `${rel}:${label}`, file: rel, type, line });
  }
}

// ── Сверка с бейслайном ─────────────────────────────────────────────────────
const foundKeys = [...new Set(violations.map((v) => v.key))].sort();

if (UPDATE) {
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const next = {};
  for (const key of foundKeys) next[key] = base[key] ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши';
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Бейслайн обновлён: ${foundKeys.length} нарушений.`);
  for (const key of foundKeys) console.log(`   ${key}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `❌ нет бейслайна ${BASELINE} — зафиксируй текущее состояние:\n` +
      '   node scripts/check-body-dto.mjs --update',
  );
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const known = new Set(Object.keys(base));
const fresh = foundKeys.filter((k) => !known.has(k));
const goneButListed = [...known].filter((k) => !foundKeys.includes(k));
const noReason = Object.entries(base).filter(([, why]) => String(why).length < 20);

if (VERBOSE) {
  for (const v of violations) {
    console.log(`   ${v.file}:${v.line} — ${v.type}`);
  }
}

const problems = [];
if (fresh.length > 0) {
  problems.push(
    'новые `@Body()` без class-DTO (ValidationPipe для них прозрачен, тело' +
      ' не проверяется в рантайме):',
    ...fresh
      .map((k) => violations.find((v) => v.key === k))
      .map((v) => `   ${v.file}:${v.line} — @Body() ...: ${v.type}`),
  );
}
if (goneButListed.length > 0) {
  problems.push(
    'записи бейслайна протухли — нарушения больше нет (тип стал классом или' +
      ' код удалён):',
    ...goneButListed.map((k) => `   ${k}`),
  );
}
if (noReason.length > 0) {
  problems.push(
    'исключение без внятной причины (следующий редактор не поймёт риск):',
    ...noReason.map(([k]) => `   ${k}`),
  );
}

if (problems.length > 0) {
  console.error('❌ гейт DTO у @Body():');
  for (const p of problems) console.error(p);
  console.error(
    'interface/type/Record<...> в @Body() — иллюзия типобезопасности:\n' +
      'class-validator/class-transformer читают декораторы РЕФЛЕКСИЕЙ класса,\n' +
      'у интерфейсов и type-алиасов её нет в рантайме — Nest пропускает тело\n' +
      'запроса без единой проверки. Замени на `export class FooDto` с\n' +
      'декораторами class-validator, либо, если Record осознан (например,\n' +
      'подписанный внешний payload, whitelist сломал бы верификацию), впиши\n' +
      'причину:\n' +
      '   node scripts/check-body-dto.mjs --update',
  );
  process.exit(1);
}

console.log(
  `✓ гейт DTO у @Body(): ${totalUnkeyed} параметров, ${totalOk} — class-DTO,` +
    ` ${foundKeys.length} известных исключений.`,
);
