#!/usr/bin/env node
// Гейт: живой пул канала «Здоровый Взрослый» в БД обязан совпадать с
// src/bot/healthy-adult.data.ts (аудит 2026-08: дегендерный свип доехал до
// фолбэка, но не до сида/UPDATE-миграций — подписчики получали версии с
// мужским родом ещё несколько недель). Правки в data.ts без сопровождающей
// UPDATE-миграции в prisma/migrations/ не долетают до читателей канала.
//
// Скрипт реконструирует итоговый пул фраз из ВСЕХ migration.sql в
// хронологическом порядке каталогов (сиды INSERT ... VALUES, правки UPDATE
// SET "text" = ... WHERE "text" = ..., удаления DELETE ... WHERE "text" IN)
// и проверяет, что каждая фраза из HEALTHY_ADULT_PHRASES присутствует в
// реконструированном пуле. Не проверяет обратное (в БД может быть больше
// фраз, добавленных через админку, — это нормально) и не трогает Postgres:
// чистый парсинг SQL, fs-only, без node_modules.
//
// Починить расхождение: добавь миграцию с idempotent UPDATE/INSERT (образец
// — 20260815100000_healthy_adult_gender_sync/migration.sql).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'prisma', 'migrations');
const DATA_FILE = join(ROOT, 'src', 'bot', 'healthy-adult.data.ts');
const TABLE = 'HealthyAdultPhrase';

// Разворачивает SQL-строку '...''...' в обычный текст с одинарной кавычкой.
function unescapeSql(s) {
  return s.replace(/''/g, "'");
}

// Все одинарно-квотированные литералы в куске текста, по порядку появления.
function extractQuotedLiterals(text) {
  const re = /'((?:[^'\\]|'')*)'/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push(unescapeSql(m[1]));
  return out;
}

// Возвращает подстроку внутри парных скобок, начиная с первой '(' после
// позиции `from` (сама открывающая скобка не входит). Скобки внутри
// одинарных кавычек не считаются — на случай текста с '(' внутри фразы.
function extractBalanced(text, from) {
  const start = text.indexOf('(', from);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "'" && text[i + 1] === "'") { i++; continue; } // escaped ''
      if (c === "'") inString = false;
      continue;
    }
    if (c === "'") { inString = true; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }
  return null;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
  }
  return acc;
}

// Каталоги миграций в хронологическом порядке (имена начинаются с
// сортируемого timestamp-префикса — лексикографический порядок = временной).
const migrationDirs = readdirSync(MIGRATIONS_DIR)
  .filter((name) => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
  .sort();

const pool = new Set();
const trace = [];

for (const dir of migrationDirs) {
  const file = join(MIGRATIONS_DIR, dir, 'migration.sql');
  let sql;
  try {
    sql = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (!sql.includes(`"${TABLE}"`)) continue;

  // 1. INSERT INTO "HealthyAdultPhrase" (...) SELECT ... FROM (VALUES ...) AS seed...
  // Скобка, которую нужно сбалансировать, стоит ПЕРЕД словом VALUES
  // (`FROM (VALUES ...) AS seed`), а не после него — ищем назад от места
  // совпадения regex до ближайшей '(' (не считая пробелов).
  const insertRe = new RegExp(`INSERT\\s+INTO\\s+"${TABLE}"[\\s\\S]*?\\(\\s*VALUES\\b`, 'gi');
  let m;
  while ((m = insertRe.exec(sql))) {
    const openParen = sql.lastIndexOf('(', insertRe.lastIndex - 'VALUES'.length);
    const tuples = extractBalanced(sql, openParen);
    // tuples = содержимое внутри (VALUES ...)  список ('текст', N), ('текст', N), ...
    if (tuples) {
      for (const text of extractQuotedLiterals(tuples)) {
        pool.add(text);
        trace.push(`${dir}: INSERT '${text.slice(0, 40)}…'`);
      }
    }
  }

  // 2. DELETE FROM "HealthyAdultPhrase" WHERE "text" IN (...)
  const deleteRe = new RegExp(`DELETE\\s+FROM\\s+"${TABLE}"\\s+WHERE\\s+"text"\\s+IN\\s*\\(`, 'gi');
  while ((m = deleteRe.exec(sql))) {
    const list = extractBalanced(sql, deleteRe.lastIndex - 1);
    if (list) {
      for (const text of extractQuotedLiterals(list)) {
        pool.delete(text);
        trace.push(`${dir}: DELETE '${text.slice(0, 40)}…'`);
      }
    }
  }

  // 3. UPDATE "HealthyAdultPhrase" SET "text" = 'NEW' ... WHERE "text" = 'OLD'
  const updateRe = new RegExp(
    `UPDATE\\s+"${TABLE}"\\s+SET\\s+"text"\\s*=\\s*'((?:[^'\\\\]|'')*)'[\\s\\S]*?WHERE\\s+"text"\\s*=\\s*'((?:[^'\\\\]|'')*)'`,
    'gi',
  );
  while ((m = updateRe.exec(sql))) {
    const next = unescapeSql(m[1]);
    const prev = unescapeSql(m[2]);
    if (pool.has(prev)) {
      pool.delete(prev);
      pool.add(next);
      trace.push(`${dir}: UPDATE '${prev.slice(0, 30)}…' -> '${next.slice(0, 30)}…'`);
    } else {
      // WHERE не находит совпадения — идемпотентно ничего не делает (строка
      // уже была правлена другой миграцией или руками через админку). Не
      // считаем это ошибкой реконструкции.
      pool.add(next); // владелец мог руками довести пул до целевого текста
    }
  }
}

// Парсим HEALTHY_ADULT_PHRASES из data.ts тем же способом, что и SQL-литералы
// (одинарные кавычки, экранирование \' — единственное отличие от SQL).
const dataSrc = readFileSync(DATA_FILE, 'utf8');
const arrMatch = dataSrc.match(/HEALTHY_ADULT_PHRASES[^=]*=\s*\[([\s\S]*)\];\s*$/);
if (!arrMatch) {
  console.error(`❌ Не удалось найти HEALTHY_ADULT_PHRASES в ${DATA_FILE}`);
  process.exit(1);
}
const tsRe = /'((?:[^'\\]|\\.)*)'/g;
const phrases = [];
let tm;
while ((tm = tsRe.exec(arrMatch[1]))) {
  phrases.push(tm[1].replace(/\\'/g, "'"));
}

const missing = phrases.filter((p) => !pool.has(p));

if (missing.length > 0) {
  console.error(
    `❌ Пул канала «Здоровый Взрослый» в БД (по миграциям) разошёлся с ${
      'src/bot/healthy-adult.data.ts'
    }.\n` +
      `   ${missing.length} фраз(ы) из data.ts нет в реконструированном пуле — правка не доехала до миграции:\n`,
  );
  for (const p of missing) console.error(`   - ${p}`);
  console.error(
    '\nДобавь idempotent UPDATE (или INSERT) в новую миграцию prisma/migrations/ ' +
      '— образец: 20260815100000_healthy_adult_gender_sync/migration.sql.',
  );
  process.exit(1);
}

console.log(
  `✓ Пул синхронизирован: все ${phrases.length} фраз(ы) из data.ts присутствуют в реконструированном пуле БД (${pool.size} фраз всего, ${migrationDirs.length} миграций просканировано).`,
);
