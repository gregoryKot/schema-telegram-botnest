#!/usr/bin/env node
// Гейт: контроллер не режет поля запроса молча (находка аудита 2026-10-11,
// backend#29).
//
// Что происходило. DTO пускал заметку терапевта до 10 000 знаков, а
// контроллер ниже делал `body.text.slice(0, 5000)`. Заметка на шесть тысяч
// отвечала 201, возвращала «сохранённый» текст на пять тысяч, а хвост терялся
// без ошибки, без предупреждения и без следа в логах — по построению: ошибки
// нет, значит нечего логировать. Ровно такая же пара «DTO шире, чем slice»
// нашлась в заметке дня (500), дневниках (2000/500), практиках (200), картах
// режимов (120/80/8) и заявке с сайта (100/500/200). Спек, написанный вместе
// со `slice`, закреплял обрезку как желаемое поведение — CI видел зелёное.
//
// Правило. Предел длины — один и стоит в DTO (`@MaxLength`): превышение —
// 400 от глобального ValidationPipe, человек видит отказ, а не «сохранилось».
// Поэтому в `src/**/*.controller.ts` запрещено `.slice(0, …)`,
// `.substring(0, …)` и `.substr(0, …)`. Срез ввода, который «просто
// безопаснее», — это и есть молчаливая потеря данных.
//
// Исключение — только в scripts/body-truncation-baseline.json, ключ
// `<файл>: <строка кода>`, значение — честная причина (не короче 20 знаков).
// Законные случаи — срез не ввода, а даты из ISO-момента (`…slice(0, 10)`).
// Флага --update нет намеренно: это классификация, а не счётчик (как у
// check-cron-leader.mjs) — «замороженный остаток» для молчаливой потери
// данных недопустим, весь класс вычищен в том же PR, что завёл гейт.
// Протухшая запись (строки больше нет) тоже роняет гейт.
//
// Чего гейт не видит: сервисов. Там `slice` законен в сотне мест (усечение
// строки лога, превью в DM), и отличить его от среза ввода регэкспом нельзя;
// сервис, которому контроллер отдаёт тело как есть, обязан полагаться на DTO.
//
//   node scripts/check-body-truncation.mjs            # проверка
//   node scripts/check-body-truncation.mjs --verbose  # что именно найдено
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'body-truncation-baseline.json');
const VERBOSE = process.argv.includes('--verbose');
const MIN_REASON = 20;

const CUT_RE = /\.(?:slice|substring|substr)\(\s*0\s*,/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

const found = []; // { key, file, line }
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const lines = stripComments(readFileSync(file, 'utf8'), false).split('\n');
  lines.forEach((text, i) => {
    if (CUT_RE.test(text)) {
      found.push({ key: `${rel}: ${text.trim()}`, file: rel, line: i + 1 });
    }
  });
}

if (VERBOSE) for (const f of found) console.log(`   ${f.file}:${f.line} — ${f.key}`);

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const foundKeys = new Set(found.map((f) => f.key));

const fresh = found.filter((f) => !(f.key in base));
const stale = Object.keys(base).filter((k) => !foundKeys.has(k));
const noReason = Object.entries(base).filter(
  ([, why]) => String(why).trim().length < MIN_REASON,
);

const problems = [];
if (fresh.length > 0) {
  problems.push(
    'контроллер режет строку `.slice(0, N)` / `.substring(0, N)` — если это поле запроса,' +
      ' хвост пропадёт молча (ответ 201 с урезанным текстом). Лимит — один, в DTO:' +
      ' `@MaxLength(N)`, превышение даст 400. Если это не ввод (дата из ISO-момента и т.п.),' +
      ' внеси строку в scripts/body-truncation-baseline.json с причиной:',
    ...fresh.map((f) => `   ${f.file}:${f.line} — ${f.key.slice(f.file.length + 2)}`),
  );
}
if (stale.length > 0) {
  problems.push(
    'в scripts/body-truncation-baseline.json записи, которых в коде больше нет' +
      ' (строку изменили или удалили — сверься и убери запись):',
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
  console.error(`❌ гейт обрезки тела запроса:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(
  `✓ гейт обрезки тела запроса: контроллеров с \`.slice(0, N)\` над вводом нет,` +
    ` законных исключений ${found.length}.`,
);
