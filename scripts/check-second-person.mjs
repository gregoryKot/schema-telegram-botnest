#!/usr/bin/env node
// Храповик обращения вне механики форм (свип 2026-08, правило CLAUDE.md
// «Обращение ты/вы»).
//
// check-address-form.mjs уже ловит жёсткие «ты»-МЕСТОИМЕНИЯ во фронтендах —
// этот гейт закрывает то, что он не видел: (1) захардкоженные ИМПЕРАТИВЫ
// («Нажми», «Заполни») без единого местоимения рядом, (2) захардкоженные
// «вы»-формы (тоже баг — их увидит «ты»-пользователь), (3) бэкенд (`src/`),
// откуда шлются письма/уведомления. Ровно этот класс дал реальные баги
// аудита 2026-08: блок /account webapp, BottomSheet мини-аппа, три
// InfoOverlay и письма — «вы»-пользователь читал «ты», потому что строка
// жила вне tr()/t()/pickForm().
//
// Калибровка 2026-08 (второй свип): исходный бейслайн (359 вхождений/68
// файлов) на большинство состоял из ложных срабатываний двух классов —
// правила и разбор каждого случая вынесены в second-person-patterns.mjs:
//   EXCLUDE            — зоны физически вне механики addressForm (маркетинг,
//                         анонимные страницы, юр. документы, админка,
//                         владелец-only DM/отчёты, мета-код детектора).
//   CALL_ARG_EXEMPT    — вызовы, чьи строковые аргументы легитимно вне
//                         отдельной вилки: сама вилка форм (tr/t/pickForm)
//                         ИЛИ владелец-only канал алертов.
//   PAIR_ARRAY_ANCHOR  — таблицы [ты-текст, вы-текст] (`Array<[string,
//                         string]>`) — гейт их не распознавал совсем.
// Оставшийся бейслайн — see second-person-baseline.json — реальный долг:
// обычные компоненты приложения с хардкодом мимо tr(), включая один
// найденный при калибровке настоящий баг (telegram.reply-helpers.ts —
// «Вы в паре!» без t()) и одну зону, ошибочно предложенную к исключению
// координатором, но НЕ исключённую (LinkDevicePage.tsx — форма там доступна,
// страница требует authenticated).
//
// Пофайловый храповик, как check-robot-phrases.mjs/check-gendered-forms.mjs:
// счётчик может только падать, новый файл рождается с нулём.
//   node scripts/check-second-person.mjs --update    — зафиксировать снижение
//   node scripts/check-second-person.mjs --verbose   — что именно насчитано
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  PATTERNS,
  EXCLUDE,
  CALL_ARG_EXEMPT,
  PAIR_ARRAY_ANCHOR,
} from './second-person-patterns.mjs';
import {
  blankExemptCalls,
  blankPairArrays,
  blankQuotedSpans,
  blankTyVyObjectPairs,
} from './second-person-blanking.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'second-person-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];

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

// CLI-логика — только при запуске как скрипт (не при импорте PATTERNS/EXCLUDE).
function main() {
  const counts = {};
  const details = {};
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      if (EXCLUDE.some((re) => re.test(file))) continue;
      let raw;
      try {
        raw = readFileSync(join(ROOT, file), 'utf8');
      } catch {
        continue;
      }
      let scanned = blankQuotedSpans(raw);
      scanned = blankExemptCalls(scanned);
      scanned = blankPairArrays(scanned);
      scanned = blankTyVyObjectPairs(scanned);
      let n = 0;
      scanned.split('\n').forEach((line, i) => {
        if (!/[А-Яа-я]{3}/.test(line)) return; // только строки с русским текстом
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // комментарии — не user-facing
        const code = line.replace(/\/\/.*$/, ''); // строчный комментарий в хвосте — не user-facing
        for (const [name, re] of PATTERNS) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(code))) {
            n++;
            (details[file] ||= []).push(`  L${i + 1} [${name}] ${m[0].trim()}`);
          }
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
      `Бейслайн обновлён: ${total} вхождений в ${Object.keys(counts).length} файлах.`,
    );
    process.exit(0);
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — сгенерируй: node scripts/check-second-person.mjs --update',
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
    console.error('❌ Обращение вне механики форм: стало хуже.\n');
    for (const [file, was, now] of grown) {
      console.error(`  ${file}: ${was} → ${now}`);
      for (const d of details[file] || []) console.error(d);
    }
    for (const [file, n] of born) {
      console.error(`  ${file}: новый файл с ${n} вхождениями (допустимо 0)`);
      for (const d of details[file] || []) console.error(d);
    }
    console.error(
      '\nСтрока с обращением («ты»/«вы», местоимение или императив) обязана\n' +
        'идти через tr("ты-вариант", "вы-вариант") / t(form, …) / pickForm(form, …) —\n' +
        'иначе пользователь с другой формой увидит чужое обращение (аудит 2026-08:\n' +
        '/account, BottomSheet, InfoOverlay, письма). Бейслайн обновляется только\n' +
        'вниз: node scripts/check-second-person.mjs --update',
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
      ? `✓ Обращение вне механики форм: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-second-person.mjs --update`
      : `✓ Обращение вне механики форм: ${total} (без роста)`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
