#!/usr/bin/env node
// Гейт: у строкового поля DTO есть верхняя граница (находка аудита 2026-10-11,
// `VirtualClientDto.name`).
//
// Что происходило. Поле объявлено `@IsString()` и больше ничем: глобальный
// ValidationPipe проверил, что это строка, и пропустил. Тело запроса
// принимается до 256 КБ (`BODY_LIMIT`), значит имя виртуального клиента на
// четверть мегабайта ложилось в БД и приезжало в каждый ответ `GET /clients`.
// `check-body-dto.mjs` такое не видит: он смотрит, что у `@Body()` стоит
// класс, а не что лежит внутри класса.
//
// Правило. Поле с `@IsString(` обязано нести декоратор, который ограничивает
// длину: `@MaxLength`/`@Length` напрямую, либо формат, у которого длина
// конечна (`@IsIn`, `@IsEnum`, `@IsUUID`, `@IsISO8601`, `@IsEmail`).
// `@Matches` границей НЕ считается: регэксп без квантора длину не ограничивает,
// а решить по тексту регэкспа, ограничивает ли он, нельзя. `@IsNotEmpty` —
// тоже нет (это нижняя граница). Для `@IsString({ each: true })` граница
// должна быть с `each: true`.
//
// Исключение — scripts/dto-string-bounds-baseline.json, ключ
// `<файл>:<Класс>.<поле>`, значение — честная причина (не короче 20 знаков):
// где поле сверяется с реестром/форматом уже после DTO, либо длинное
// намеренно. Флага --update нет: это классификация, а не счётчик (как у
// check-body-truncation.mjs). Протухшая запись тоже роняет гейт.
//
//   node scripts/check-dto-string-bounds.mjs            # проверка
//   node scripts/check-dto-string-bounds.mjs --verbose  # что именно найдено
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { parseClasses } from './dto-fields.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'dto-string-bounds-baseline.json');
const VERBOSE = process.argv.includes('--verbose');
const MIN_REASON = 20;

// Декораторы, после которых длина строки конечна.
const LENGTH_BOUNDING = new Set([
  'MaxLength',
  'Length',
  'IsIn',
  'IsEnum',
  'IsUUID',
  'IsISO8601',
  'IsEmail',
]);
const EACH_RE = /\beach\s*:\s*true\b/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (
      full.endsWith('.ts') &&
      !/\.(spec|test|e2e-spec)\.ts$/.test(full)
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Поле строковое и без границы длины? */
function isUnbounded(decorators) {
  const str = decorators.find((d) => d.name === 'IsString');
  if (!str) return false;
  const each = EACH_RE.test(str.args);
  return !decorators.some(
    (d) => LENGTH_BOUNDING.has(d.name) && (!each || EACH_RE.test(d.args)),
  );
}

const found = []; // { key, file, cls, field }
for (const file of walk(SRC)) {
  const raw = readFileSync(file, 'utf8');
  if (!/from\s+['"]class-validator['"]/.test(raw)) continue;
  const rel = relative(ROOT, file).split('\\').join('/');
  for (const cls of parseClasses(stripComments(raw, false))) {
    for (const member of cls.members) {
      if (member.name && isUnbounded(member.decorators)) {
        found.push({
          key: `${rel}:${cls.name}.${member.name}`,
          file: rel,
          cls: cls.name,
          field: member.name,
        });
      }
    }
  }
}

if (VERBOSE) for (const f of found) console.log(`   ${f.key}`);

const base = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : {};
const foundKeys = new Set(found.map((f) => f.key));

const fresh = found.filter((f) => !(f.key in base));
const stale = Object.keys(base).filter((k) => !foundKeys.has(k));
const noReason = Object.entries(base).filter(
  ([, why]) => String(why).trim().length < MIN_REASON,
);

const problems = [];
if (fresh.length > 0) {
  problems.push(
    'строковое поле DTO без верхней границы: тело запроса принимается до 256 КБ,' +
      ' и такая строка целиком уйдёт в БД и в ответы. Поставь `@MaxLength(N)`' +
      ' (константа — в src/utils/text-limits.ts, если лимит видит пользователь).' +
      ' Если длину ограничивает формат, который проверяется позже, внеси' +
      ' `файл:Класс.поле` в scripts/dto-string-bounds-baseline.json с причиной:',
    ...fresh.map((f) => `   ${f.file} — ${f.cls}.${f.field}`),
  );
}
if (stale.length > 0) {
  problems.push(
    'в scripts/dto-string-bounds-baseline.json записи, которых в коде больше нет' +
      ' или у поля уже есть граница (сверься и убери запись):',
    ...stale.map((k) => `   ${k}`),
  );
}
if (noReason.length > 0) {
  problems.push(
    `у записей бейслайна нет честной причины (короче ${MIN_REASON} знаков):`,
    ...noReason.map(([k]) => `   ${k}`),
  );
}

if (problems.length > 0) {
  console.error(`❌ гейт границ строковых полей DTO:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(
  `✓ гейт границ строковых полей DTO: у всех строковых полей есть верхняя граница,` +
    ` законных исключений ${Object.keys(base).length}.`,
);
