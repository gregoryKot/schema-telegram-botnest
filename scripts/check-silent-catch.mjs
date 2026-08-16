#!/usr/bin/env node
// Храповик тихих catch-хендлеров (три волны ужесточения тестов, 2026-08).
//
// Форма бага, найденная девять раз за три волны: `promise.catch(() => {})`
// (или `=> []` / `=> null` / …) глушит ошибку сети, а код ПОСЛЕ него
// продолжает работать так, будто запрос удался — юзер видит «✓ Сохранено»,
// хотя на сервер ничего не улетело; список задач терапевта на сетевом сбое
// молча схлопывается в пустой, потому что рефетч упал и вернул `[]`.
// tsc это не ловит (типы корректны), coverage не ловит (строка исполняется),
// ручное тестирование на хорошей сети не ловит — нужен только тест, который
// роняет запрос. Правило без гейта не работает (CLAUDE.md), поэтому счётчик
// заморожен пофайлово и может только падать — как в check-robot-phrases.mjs
// и check-gendered-forms.mjs, по образцу которых написан этот скрипт.
//
// Что считаем «тихим catch» (см. PATTERNS ниже):
//   .catch(() => {})       — пустое тело, эффекта нет вообще
//   .catch(() => [])       — фолбэк на пустой список ЗАМЕНЯЕТ реальные данные
//   .catch(() => null)     — то же для одиночного значения
//   .catch(() => undefined)
//   .catch(() => 0)
//   .catch(() => false)
//   try { … } catch { }    — и `catch (e) {}` — тело statement-catch пустое
//
// Что НЕ считаем (сознательное решение, не забывчивость):
//   - тестовые файлы (*.test.ts(x), *.spec.ts) — там глушить рассинхрон
//     легитимно (мок, ожидаемый reject);
//   - dist/, node_modules/, game/ (game — заморожен отдельным правилом);
//   - catch-тело с комментарием-но-без-кода технически не «пустое» по этому
//     скрипту (регэксп ищет буквально `{}`) — известная слепая зона, см. ALLOW
//     ниже про то, почему список короткий: цель — поймать опасное
//     большинство, а не рассудить каждый случай.
//
// Аллоу-лист (см. ALLOW) — вызовы, где .catch(() => …) не факт ошибки, а
// продуктовое решение: fire-and-forget аналитика (правило №8 CLAUDE.md) и
// best-effort Telegram-ответ внутри error-хендлера (раздел «Обработка ошибок»
// CLAUDE.md прямо требует `.catch(() => null)` на editMessageText/reply —
// иначе вторая ошибка при попытке сообщить о первой роняет весь хендлер).
// Список короткий и с обоснованием на каждую строку — не место для «на всякий
// случай впишу что-нибудь ещё».
//
// Снизил счётчик — зафиксируй, чтобы файл нельзя было засорить снова:
//   node scripts/check-silent-catch.mjs --update
// Посмотреть, что именно насчитано: --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  ARG,
  PATTERNS,
  CHAIN_ALLOW,
  ENCLOSING_WINDOW,
  ENCLOSING_ALLOW,
} from './silent-catch-rules.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'silent-catch-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];

/** Имя метода, чей промис ловится этим `.catch(` (null, если это не цепочка). */
function caughtCallName(src, matchStart) {
  let i = matchStart - 1;
  while (i >= 0 && /\s/.test(src[i])) i -= 1;
  if (src[i] !== ')') return null; // не `foo(...).catch(...)`
  let depth = 0;
  for (; i >= 0; i -= 1) {
    if (src[i] === ')') depth += 1;
    else if (src[i] === '(') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (i < 0) return null;
  i -= 1;
  while (i >= 0 && /\s/.test(src[i])) i -= 1;
  let end = i + 1;
  while (i >= 0 && /[A-Za-z0-9_$]/.test(src[i])) i -= 1;
  if (end <= i + 1) return null;
  const name = src.slice(i + 1, end);
  // Возвращаем имя вместе с объектом-получателем, когда он есть
  // (`navigator.share`, а не просто `share`): разрешение по голому имени
  // метода накрыло бы и одноимённый чужой вызов — у нас это `s.share()`
  // карточки-приглашения, где проглоченная ошибка как раз значима.
  if (src[i] === '.') {
    let j = i - 1;
    // prettier переносит длинную цепочку (`navigator\n  .share({…})`), поэтому
    // между точкой и объектом бывает перевод строки с отступом.
    while (j >= 0 && /\s/.test(src[j])) j -= 1;
    const objEnd = j + 1;
    while (j >= 0 && /[A-Za-z0-9_$]/.test(src[j])) j -= 1;
    if (objEnd > j + 1) return `${src.slice(j + 1, objEnd)}.${name}`;
  }
  return name;
}

function isAllowed(src, matchStart) {
  const called = caughtCallName(src, matchStart);
  // Сверяем и полное `объект.метод`, и голый метод: старые записи списка
  // (editMessageText у ctx) заданы именем метода, новые (navigator.share) —
  // с объектом, потому что голое `share` накрыло бы чужой одноимённый вызов.
  if (called !== null) {
    const bare = called.includes('.') ? called.split('.').pop() : called;
    if (CHAIN_ALLOW.includes(called) || CHAIN_ALLOW.includes(bare)) return true;
  }
  const near = src.slice(Math.max(0, matchStart - ENCLOSING_WINDOW), matchStart);
  return ENCLOSING_ALLOW.some((re) => re.test(near));
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return acc;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'game')
        continue;
      walk(rel, acc);
    } else if (
      /\.(ts|tsx)$/.test(name) &&
      !/\.(spec|test)\.(ts|tsx)$/.test(name)
    ) {
      acc.push(rel);
    }
  }
  return acc;
}

function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}

// Комментарии вычищаем ДО поиска. Иначе гейт ловит сам себя за хвост:
// строка «раньше её сбой глушился `.catch(() => {})`» — это объяснение
// починки, ровно то, что хочется поощрять, а гейт считал её нарушением
// (поймано на первом же дне работы гейта). Содержимое заменяется пробелами,
// переводы строк сохраняются — номера строк в отчёте остаются верными.
function stripComments(src) {
  return src.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (m) => m.replace(/[^\n]/g, ' '),
  );
}

const counts = {};
const details = {};
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    let src;
    try {
      src = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    src = stripComments(src);
    let n = 0;
    for (const [name, re] of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        if (isAllowed(src, m.index)) continue;
        n++;
        const line = lineAt(src, m.index);
        const snippet = m[0].replace(/\s+/g, ' ').trim();
        (details[file] ||= []).push(`  L${line} [${name}] ${snippet}`);
      }
    }
    if (n > 0) counts[file] = n;
  }
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (UPDATE) {
  const sorted = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
  console.log(
    `Бейслайн обновлён: ${total} тихих catch в ${Object.keys(counts).length} файлах.`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна — сгенерируй: node scripts/check-silent-catch.mjs --update',
  );
  process.exit(1);
}

const grown = [];
const born = [];
for (const [file, n] of Object.entries(counts)) {
  const was = baseline[file];
  if (was === undefined) born.push([file, n]);
  else if (n > was) grown.push([file, was, n]);
}

if (grown.length || born.length) {
  console.error('❌ Храповик тихих catch: стало хуже.\n');
  for (const [file, was, now] of grown) {
    console.error(`  ${file}: ${was} → ${now}`);
    for (const d of details[file] || []) console.error(d);
  }
  for (const [file, n] of born) {
    console.error(`  ${file}: новый файл с ${n} тихими catch (допустимо 0)`);
    for (const d of details[file] || []) console.error(d);
  }
  console.error(
    '\nЦена паттерна: пользователь видит «сохранено» / рабочий список, хотя\n' +
      'запрос упал и ничего не сохранилось или список молча схлопнулся в пустой\n' +
      '(девять таких багов дошли до прода за три волны тестов). Почини так:\n' +
      '  — покажи ошибку (error-стейт, тост) или откати оптимистичное обновление;\n' +
      '  — если вызов и правда fire-and-forget (аналитика, best-effort UI-чистка) —\n' +
      '    впиши имя в CHAIN_ALLOW (или ENCLOSING_ALLOW) в\n' +
      '        scripts/check-silent-catch.mjs с причиной.\n' +
      'Бейслайн обновляется только вниз: node scripts/check-silent-catch.mjs --update',
  );
  process.exit(1);
}

const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
if (VERBOSE) {
  for (const [file, ds] of Object.entries(details).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`${file} (${ds.length})`);
    for (const d of ds) console.log(d);
  }
}
console.log(
  total < baseTotal
    ? `✓ Храповик тихих catch: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-silent-catch.mjs --update`
    : `✓ Храповик тихих catch: ${total} (без роста)`,
);
