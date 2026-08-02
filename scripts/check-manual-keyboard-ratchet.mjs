#!/usr/bin/env node
// Храповик рукописных клавиатурных обёрток (инцидент 2026-08, карточка режима).
//
// Что случилось: карточка вопроса была не-кнопочным элементом с role="button" +
// onKeyDown(Enter/Space → preventDefault). Внутрь этой обёртки положили
// <textarea>, нажатия из него всплывали наверх — и пробел уходил в
// preventDefault(). Пользователь физически не мог поставить пробел в тексте.
//
// Починка живёт в ОДНОМ месте — pressable() в shared/src/utils/a11y.ts: он
// игнорирует клавиши, набранные во вложенном поле ввода. Но фикс защищает
// только тех, кто им пользуется: рукописная копия role/tabIndex/onKeyDown несёт
// старое поведение и открывает баг заново (правило «одна механика — один
// компонент», CLAUDE.md).
//
// Поэтому счётчик рукописных копий заморожен пофайлово и может только падать:
// новый интерактивный div берёт `{...pressable(fn)}`, а не пишет свой onKeyDown.
// Убрал копию — зафиксируй: node scripts/check-manual-keyboard-ratchet.mjs --update
// Посмотреть, что именно насчитано: --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'manual-keyboard-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

// Единственная легальная реализация — сам pressable и его тест.
const EXCLUDED = new Set(['shared/src/utils/a11y.ts']);

// Рукописная клавиатурная активация: role="button" на не-кнопочном элементе.
// pressable() проставляет role через спред, в исходнике его не видно — поэтому
// каждое найденное вхождение и есть копия, которую надо перевести на хук.
const MANUAL_ROLE = /role=(?:"button"|'button'|\{\s*['"]button['"]\s*\})/g;

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
      /\.tsx?$/.test(name) &&
      !/\.(spec|test)\.tsx?$/.test(name) &&
      !/\.d\.ts$/.test(name)
    ) {
      acc.push(rel);
    }
  }
  return acc;
}

const counts = {};
const details = {};
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    if (EXCLUDED.has(file)) continue;
    let src;
    try {
      src = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    let n = 0;
    src.split('\n').forEach((line, i) => {
      MANUAL_ROLE.lastIndex = 0;
      while (MANUAL_ROLE.exec(line)) {
        n++;
        (details[file] ||= []).push(`  L${i + 1} ${line.trim().slice(0, 80)}`);
      }
    });
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
    `Бейслайн обновлён: ${total} рукописных обёрток в ${Object.keys(counts).length} файлах.`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна — сгенерируй: node scripts/check-manual-keyboard-ratchet.mjs --update',
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
  console.error('❌ Храповик рукописных клавиатурных обёрток: стало хуже.\n');
  for (const [file, was, now] of grown) {
    console.error(`  ${file}: ${was} → ${now}`);
    for (const d of details[file] || []) console.error(d);
  }
  for (const [file, n] of born) {
    console.error(`  ${file}: новый файл с ${n} обёртками (допустимо 0)`);
    for (const d of details[file] || []) console.error(d);
  }
  console.error(
    '\nИнтерактивный не-кнопочный элемент берёт готовый хук:\n' +
      "  import { pressable } from '../utils/a11y';\n" +
      '  <div {...pressable(() => doX())}> … </div>\n' +
      'Там уже учтено, что нажатие из вложенного поля ввода — не нажатие\n' +
      'на карточку (инцидент 2026-08: пробел не набирался в карточке режима).\n' +
      'Нужен сам event (stopPropagation)? Пиши обработчик руками, но тем же\n' +
      'правилом: клавиши из <input>/<textarea> не перехватывать, и обнови\n' +
      'бейслайн осознанно: node scripts/check-manual-keyboard-ratchet.mjs --update',
  );
  process.exit(1);
}

if (VERBOSE) {
  for (const [file, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`${file}: ${n}`);
    for (const d of details[file] || []) console.log(d);
  }
}

console.log(
  `✓ Храповик рукописных клавиатурных обёрток: ${total} (без роста, ${Object.keys(counts).length} файлов — долг тает по мере перехода на pressable)`,
);
