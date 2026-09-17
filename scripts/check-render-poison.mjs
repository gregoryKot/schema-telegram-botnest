#!/usr/bin/env node
// Храповик размытия во фронтендах (расследование скорости, замеры на
// устройстве владельца 2026-08-26).
//
// В установленном на телефон приложении (standalone PWA) WebKit считает
// backdrop-filter и filter: blur ПРОГРАММНО — без ускорения, которое тот же
// CSS получает внутри Telegram. Полноэкранное размытие под нижней панелью
// стоило ~1.4с НА КАДР, приложение вязло метрономом всю первую минуту.
// Выключение одного размытия (эксперимент noblur) убрало 42 блока и 78с
// зависаний; тап 2000-4000мс упал до 115-196мс. Blur снят из мини-аппа
// полностью — этот гейт не даёт ему вернуться.
//
// Пофайловый храповик ЧИСЛА нарушений (формат — scripts/check-tiny-fonts.mjs),
// а не список ручных причин: у webapp-лендинга долг тает по счётчику, а не
// по вычёркиванию строк из бейслайна. Сами паттерны — в
// scripts/render-poison-patterns.mjs (правило №10: движок не растёт вместе
// со списком правил).
//
// Снизил счётчик — зафиксируй: node scripts/check-render-poison.mjs --update
// Что именно насчитано: node scripts/check-render-poison.mjs --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PATTERNS } from './render-poison-patterns.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'render-poison-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['schema-miniapp/src', 'shared/src', 'webapp/src'];

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
      if (name === 'node_modules' || name === 'dist') continue;
      walk(rel, acc);
    } else if (
      /\.(ts|tsx|css)$/.test(name) &&
      !/\.(spec|test)\.(ts|tsx)$/.test(name) &&
      !name.endsWith('.d.ts')
    ) {
      acc.push(rel);
    }
  }
  return acc;
}

// Комментарии — не поражённый код: в мини-аппе оставлены пояснения «Без
// backdrop-filter — см. BottomNav.tsx», а webapp/src/index.css объясняет
// снятие размытия текстом вида «Без backdrop-filter: в установленном…» —
// с двоеточием сразу после имени свойства. Без вырезания комментария такая
// строка ложно матчится как настоящее объявление. Стираем `//` и `/* */`
// пробелами, СОХРАНЯЯ переводы строк — номера строк в отчёте не съезжают
// (приём — scripts/second-person-blanking.mjs).
function stripComments(text, isCss) {
  const n = text.length;
  let out = '';
  let i = 0;
  let quote = null;
  while (i < n) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && i + 1 < n) {
        out += text[i + 1] === '\n' ? '\n' : ' ';
        i += 2;
        continue;
      }
      out += c;
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    // В CSS `//` комментарием НЕ является: строка `url(https://…)` в одном
    // объявлении с размытием прятала бы его от гейта (найдено ревью
    // 2026-08-26). Там режем только `/* */`.
    if (!isCss && c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function scanFile(src, isCss) {
  const hits = [];
  stripComments(src, isCss)
    .split('\n')
    .forEach((line, i) => {
      for (const [name, re] of PATTERNS) {
        re.lastIndex = 0;
        while (re.exec(line)) {
          hits.push(`  L${i + 1} [${name}] ${line.trim().slice(0, 90)}`);
        }
      }
    });
  return hits;
}

function main() {
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
      const hits = scanFile(src, file.endsWith('.css'));
      if (hits.length > 0) {
        counts[file] = hits.length;
        details[file] = hits;
      }
    }
  }

  if (UPDATE) {
    const sorted = Object.fromEntries(
      Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(
      `Бейслайн обновлён: ${total} нарушений размытия в ${Object.keys(counts).length} файлах.`,
    );
    process.exit(0);
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — сгенерируй: node scripts/check-render-poison.mjs --update',
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
    console.error('❌ Храповик размытия: стало хуже.\n');
    for (const [file, was, now] of grown) {
      console.error(`  ${file}: ${was} → ${now}`);
      for (const d of details[file] || []) console.error(d);
    }
    for (const [file, n] of born) {
      console.error(`  ${file}: новый файл с ${n} нарушениями (допустимо 0)`);
      for (const d of details[file] || []) console.error(d);
    }
    console.error(
      '\nВ установленном на телефон приложении (PWA) WebKit считает\n' +
        'backdrop-filter и filter: blur программно: каждый кадр стоит ~1.4с,\n' +
        'приложение вязнет (замеры на устройстве владельца 2026-08-26).\n' +
        'Замени на непрозрачную подложку — --nav-bg уже равен цвету фона,\n' +
        'панель выглядит так же, но без размытия.\n' +
        'Бейслайн обновляется только вниз: node scripts/check-render-poison.mjs --update',
    );
    process.exit(1);
  }

  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
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
      ? `✓ Храповик размытия: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-render-poison.mjs --update`
      : `✓ Храповик размытия: ${total} (без роста)`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
