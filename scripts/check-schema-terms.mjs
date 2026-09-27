#!/usr/bin/env node
// Гейт терминологии схема-терапии (докладная владельца: «схема Неудача» в
// статье вместо канонического термина МИСТ «Неуспешность»).
//
// Эталон — docs/TERMINOLOGY.md (сверено с sсhema-therapy.ru 2026-09-27).
// Правила — scripts/schema-terms-rules.mjs (движок не растёт вместе со
// списком терминов, правило №10 CLAUDE.md).
//
// Абсолютный запрет, БЕЗ бейслайна и без --update: класс размётся полностью
// сейчас (агенты параллельно правят тексты), замораживать нечего — как
// check-var-alpha-suffix.mjs/check-legacy-name.mjs. Гейт без замороженного
// долга сильнее (правило №15 CLAUDE.md): нет ложного долга, некуда молча
// спрятать регресс через --update.
//
// Область сканирования — user-facing тексты продукта: бэкенд (уведомления,
// e-mail), оба фронтенда, shared, игра, и статика вне src/ (index.html,
// webapp/public/** — тот же слепой участок, что закрывал check-robot-phrases
// после инцидента с самоназванием, правило №14). prisma/migrations и docs/ —
// вне области: миграции неизменяемы (история), а сам docs/TERMINOLOGY.md
// обязан ЦИТИРОВАТЬ запрещённые варианты в колонке «Не писать».
//
// Комментарии в коде НЕ вычищаются перед сканированием (в отличие от
// check-var-alpha-suffix.mjs) — решение: класс термина редкий и специфичный,
// а комментарий, ссылающийся на неправильное имя схемы, тоже стоит
// поправить (следующий автор copy-paste'ит из комментария не реже, чем из
// кода). Если это создаст шум на реальном дереве — сузить нетрудно, сузив
// сами паттерны в schema-terms-rules.mjs, а не движок.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { RULES, ALLOW } from './schema-terms-rules.mjs';

const ROOT = join(import.meta.dirname, '..');
const SELF = 'schema-terms-rules.mjs';

const SCAN_DIRS = ['src', 'webapp/src', 'shared/src', 'schema-miniapp/src', 'game/src'];
const SCAN_FILES = ['webapp/index.html'];
// webapp/public/** — статика вне src/, никем не импортируется (правило №14).
const SCAN_PUBLIC_DIRS = ['webapp/public'];

const EXT_RE = /\.(ts|tsx|js|mjs|html|txt|json|md|xml|webmanifest)$/;
const SKIP_RE = /\.(spec|test)\.(ts|tsx|js|mjs)$/;

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
      if (name === 'node_modules' || name === 'dist') continue;
      walk(rel, acc);
      continue;
    }
    if (name === SELF) continue;
    if (SKIP_RE.test(name)) continue;
    if (EXT_RE.test(name)) acc.push(rel);
  }
  return acc;
}

function stripAllow(line) {
  return ALLOW.reduce(
    (acc, a) => acc.replace(new RegExp(a.source, a.flags.replace('g', '') + 'g'), ' '),
    line,
  );
}

function scanFile(rel, found) {
  let src;
  try {
    src = readFileSync(join(ROOT, rel), 'utf8');
  } catch {
    return;
  }
  src.split('\n').forEach((line, i) => {
    if (!/[А-Яа-яЁё]/.test(line)) return; // только строки с русским текстом
    const scan = stripAllow(line);
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let m;
      while ((m = rule.pattern.exec(scan))) {
        found.push({
          file: rel,
          ln: i + 1,
          rule: rule.id,
          text: m[0].trim(),
          canonical: rule.canonical,
          hint: rule.hint,
        });
        if (m[0].length === 0) rule.pattern.lastIndex++; // защита от зацикливания
      }
    }
  });
}

function main() {
  const files = [
    ...SCAN_DIRS.flatMap((d) => walk(d)),
    ...SCAN_PUBLIC_DIRS.flatMap((d) => walk(d)),
    ...SCAN_FILES,
  ];

  const found = [];
  for (const file of files) scanFile(file, found);

  if (found.length) {
    console.error(
      `❌ Терминология схема-терапии: ${found.length} расхождений с docs/TERMINOLOGY.md.\n`,
    );
    for (const f of found) {
      console.error(`  ${f.file}:${f.ln} «${f.text}» → «${f.canonical}»`);
      console.error(`    [${f.rule}] ${f.hint}`);
    }
    console.error(
      '\nЭталон — сайт МИСТ (schema-therapy.ru), сверка — docs/TERMINOLOGY.md.\n' +
        'Правило без гейта уже возвращалось: «схема Неудача» вместо «Неуспешность»\n' +
        'в статье. Замены нет по --update — это классификация термина, а не\n' +
        'счётчик долга (как cron-leader/raw-sql-live).',
    );
    process.exit(1);
  }

  console.log(`✓ терминология схема-терапии: расхождений с docs/TERMINOLOGY.md нет (${files.length} файлов).`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
