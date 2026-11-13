#!/usr/bin/env node
// Гейт орфографии видимых строк. Родился из QA 2026-11: «оффлайн» стояло в
// карточке клиента терапевта на обеих площадках — в плашке, во вкладке
// способа добавления, в имени карточки без имени, в фильтре списка. По
// словарю (Русский орфографический словарь РАН) — «офлайн» с одной «ф», как
// «онлайн». Ошибка жила в шести файлах: следующий автор копировал её из
// соседнего, и правка одного места не мешала ей вернуться.
//
// Абсолютный запрет без бейслайна и без --update, как check-schema-terms.mjs:
// класс вычищен целиком, замораживать нечего, а гейт без замороженного долга
// некуда молча поднять (правило №15).
//
// Смотрит только то, что видит человек. Комментарии стираются общим сканером
// (scripts/gate-strip-comments.mjs): орфография пояснения в коде пользователю
// не видна, и ради неё гейт не краснеет. Спеки и тесты — вне области: они
// ищут видимую строку и чинятся вместе с ней, а в фикстурах законны любые
// имена («Оффлайн Иван» в данных теста — не текст интерфейса).
//
// Новое правило — строка в RULES (spelling-rules.mjs) плюс образец и контрольный образец в
// src/test-support/gates/spelling.spec.ts.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { RULES } from './spelling-rules.mjs';

const ROOT = join(import.meta.dirname, '..');

// Тексты продукта: бэкенд (бот, уведомления, письма), оба фронтенда, shared, игра.
const SCAN_DIRS = ['src', 'webapp/src', 'shared/src', 'game/src'];
const EXT_RE = /\.(ts|tsx|js|mjs)$/;
const SKIP_FILE_RE = /\.(spec|test)\.(ts|tsx|js|mjs)$|\.d\.ts$/;
// Инфраструктура тестов: фикстуры и хелперы, пользователю не показываются.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'test-support']);

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return acc;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    let st;
    try {
      st = statSync(join(ROOT, rel));
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(rel, acc);
      continue;
    }
    if (EXT_RE.test(name) && !SKIP_FILE_RE.test(name)) acc.push(rel);
  }
  return acc;
}

/** `file` — путь от корня: по нему правило с `skip` пропускает свою слепую зону. */
export function scanText(text, file = '') {
  const found = [];
  stripComments(text, false)
    .split('\n')
    .forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.skip?.test(file)) continue;
        for (const m of line.matchAll(rule.pattern)) {
          found.push({ ln: i + 1, rule, text: m[0] });
        }
      }
    });
  return found;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  const found = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    for (const f of scanText(text, file)) found.push({ file, ...f });
  }

  if (found.length) {
    console.error(`❌ Орфография видимых строк, найдено: ${found.length}.\n`);
    for (const f of found) {
      console.error(`  ${f.file}:${f.ln} «${f.text}» → «${f.rule.canonical}»`);
      console.error(`    [${f.rule.id}] ${f.rule.hint}`);
    }
    console.error(
      '\nКомментарии и тесты гейт не смотрит — только строки, которые видит человек.\n' +
        'Бейслайна и --update нет: исправь написание.',
    );
    process.exit(1);
  }

  console.log(
    `✓ орфография видимых строк: ошибок нет (${files.length} файлов).`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
