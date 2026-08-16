#!/usr/bin/env node
// Храповик мужского рода в текстах, обращённых к пользователю (свип 2026-08).
//
// Продукт обращается на «ты», а русский язык в прошедшем времени и в кратких
// прилагательных род не прячет: «ты сделал», «ты не обязан», «ты вырос»,
// «позволь себе быть сильным». Половина читателей — женщины, и для них весь
// продукт звучал как написанный не им. Форма «вы» от этого защищена сама
// (множественное число рода не имеет), а «ты» — нет, и она стоит по умолчанию.
//
// Как чинить (в порядке предпочтения, docs/VOICE.md — живой язык):
//   1. настоящее/будущее время: «ты перечитал» → «перечитываешь»;
//   2. безличный оборот: «когда ты справился» → «когда удалось справиться»;
//   3. существительное вместо прилагательного: «быть уязвимым» → «уязвимость».
// Скобки «сделал(а)» — не решение: это канцелярит, а не русский язык.
//
// Слепые зоны свипа 2026-08 (ручная вычитка 116 вопросов YSQ + карточек
// режимов нашла ~50 форм, которые гейт не ловил — см. CLAUDE.md, раздел
// «Род читателя»). Закрыты здесь:
//   а) dropped-subject-past ловил только глаголы научения/привыкания —
//      список расширен реальными пропусками (справился, вырос, устал…);
//   б) «сам»/«один» были ТОЛЬКО filler'ом в FILLER (гасились, чтобы не мешать
//      искать соседний глагол), но никогда не были целью сами — новый
//      паттерн solo-verb-m ловит их именно как ЦЕЛЬ, когда рядом глагол
//      1/2 лица («Справлюсь сам», «останусь один»), с исключением идиом
//      «сам по себе» / «один раз» / «один из» — они не про род;
//   в) ya-short-adj — список кратких прилагательных был короче, чем ty-short-adj
//      («я уверен», «я способен» и т.п. проходили мимо) — список выровнен;
//   г) inf-adj-m требовал прилагательное СРАЗУ после инфинитива и не видел
//      спрягаемые формы («чувствую себя маленьким», «оказаться недостаточным»)
//      и наречие-разделитель («быть максимально продуктивным») — добавлены
//      спрягаемые «чувствую/чувствуешь себя», глаголы оказаться/показаться/
//      выглядеть и допуск до 3 слов между глаголом и прилагательным.
//      Минимальная длина основы прилагательного (2+ буквы до «ым/им»)
//      отсекает ложные срабатывания на местоимениях «им»/«ним».
//
// Снизил счётчик — зафиксируй, чтобы файл нельзя было засорить снова:
//   node scripts/check-gendered-forms.mjs --update
// Посмотреть, что именно насчитано: --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PATTERNS, ALLOW } from './gendered-forms-patterns.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'gendered-forms-baseline.json');
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
      if (name === 'node_modules' || name === 'dist') continue;
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

// CLI-логика — только при запуске как скрипт (не при импорте PATTERNS/ALLOW).
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
    let n = 0;
    src.split('\n').forEach((line, i) => {
      if (!/[А-Яа-я]{4}/.test(line)) return; // только строки с русским текстом
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // комментарии — не user-facing
      // Исключения гасят ТОЛЬКО свой фрагмент, а не всю строку: иначе одна
      // законная конструкция делает невидимым всё остальное в той же строке
      // (реальный случай — «Здоровый Взрослый слышит тебя: … и ты не один»,
      // где ALLOW на «Здоровый Взрослый» прятал «ты не один»).
      const scan = ALLOW.reduce(
        (acc, a) => acc.replace(new RegExp(a.source, a.flags.replace('g', '') + 'g'), ' '),
        line,
      );
      for (const [name, re] of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(scan))) {
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
    `Бейслайн обновлён: ${total} мужских форм в ${Object.keys(counts).length} файлах.`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна — сгенерируй: node scripts/check-gendered-forms.mjs --update',
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
  console.error('❌ Храповик мужского рода: стало хуже.\n');
  for (const [file, was, now] of grown) {
    console.error(`  ${file}: ${was} → ${now}`);
    for (const d of details[file] || []) console.error(d);
  }
  for (const [file, n] of born) {
    console.error(`  ${file}: новый файл с ${n} мужскими формами (допустимо 0)`);
    for (const d of details[file] || []) console.error(d);
  }
  console.error(
    '\nЭтот текст читают и женщины: «ты сделал» и «позволь себе быть\n' +
      'сильным» для половины пользователей звучат как чужие. Перепиши в\n' +
      'настоящем времени («перечитываешь»), безлично («когда удалось\n' +
      'справиться») или через существительное («уязвимость» вместо «быть\n' +
      'уязвимым»). Скобки «сделал(а)» — не решение, см. CLAUDE.md.\n' +
      'Бейслайн обновляется только вниз: node scripts/check-gendered-forms.mjs --update',
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
    ? `✓ Храповик мужского рода: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-gendered-forms.mjs --update`
    : `✓ Храповик мужского рода: ${total} (без роста)`,
);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
