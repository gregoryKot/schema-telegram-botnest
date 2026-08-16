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
// Пофайловый храповик, как check-robot-phrases.mjs/check-gendered-forms.mjs:
// счётчик может только падать, новый файл рождается с нулём.
//   node scripts/check-second-person.mjs --update    — зафиксировать снижение
//   node scripts/check-second-person.mjs --verbose   — что именно насчитано
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'second-person-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];

// Маркетинг сайта осознанно вне addressForm (CLAUDE.md: «Лендинг/статьи/игра
// сайта — маркетинг, не привязаны к addressForm, их не трогаем») — как в
// check-address-form.mjs, иначе весь копирайт лендинга read-only попадает в
// «долг» и шумит в топе файлов, ничего не давая проверке.
export const EXCLUDE = [
  /webapp\/src\/pages\/(LandingPage|ProductLandingPage|ArticlesPage|GamePage|ReviewsPage|articleDiagrams)/,
];

// \b в JS — ASCII-only, кириллицу не видит: границы слова через lookaround.
const L = '(?<![А-Яа-яЁё])';
const R = '(?![А-Яа-яЁё])';

function bothCase(word) {
  return `[${word[0]}${word[0].toLowerCase()}]${word.slice(1)}`;
}

// Императивы 2 л. ед.ч. (глушится, если внутри tr()/t()/pickForm()) — база из
// правила CLAUDE.md плюс грep реальных tr()-вызовов проекта (замер
// 2026-08-16: частотный список аргументов tr('Слово…')). true = возвратный
// глагол («-ся/-сь»), у него другое окончание в форме «вы» (см. vyForm).
const TY_IMPERATIVES = [
  ['Нажми', false], ['Открой', false], ['Введи', false], ['Выбери', false],
  ['Попробуй', false], ['Проверь', false], ['Скопируй', false], ['Сохрани', false],
  ['Заполни', false], ['Напиши', false], ['Отметь', false], ['Перейди', false],
  ['Установи', false], ['Приглашай', false], ['Перезайди', false], ['Продолжи', false],
  ['Начни', false], ['Закрой', false], ['Скажи', false], ['Заметь', false],
  ['Запиши', false], ['Сделай', false], ['Позволь', false], ['Попроси', false],
  ['Подумай', false], ['Спроси', false], ['Найди', false], ['Поделись', true],
  ['Вспомни', false], ['Поиграй', false], ['Проведи', false], ['Придумай', false],
  ['Поговори', false], ['Возьми', false], ['Послушай', false], ['Дай', false],
  ['Прими', false], ['Назови', false], ['Выскажи', false], ['Включи', false],
  ['Нарисуй', false], ['Пересмотри', false], ['Поставь', false], ['Пройди', false],
  ['Запомни', false], ['Опиши', false], ['Позвони', false], ['Расскажи', false],
  ['Признайся', true], ['Доверься', true], ['Выйди', false], ['Скорчи', false],
  ['Переставь', false], ['Посмотри', false], ['Напой', false], ['Пойди', false],
  ['Съешь', false], ['Встань', false], ['Зайди', false], ['Сыграй', false],
  ['Пофотографируй', false], ['Откажись', true], ['Уйди', false], ['Почувствуй', false],
];

// «Поделись»→«Поделитесь», «Доверься»→«Доверьтесь»: возвратные глаголы меняют
// «-ся/-сь» на «-тесь», а не просто дописывают «те».
function vyForm([word, reflexive]) {
  return reflexive ? word.slice(0, -2) + 'тесь' : word + 'те';
}

const tyAlt = TY_IMPERATIVES.map(([w]) => bothCase(w)).join('|');
const vyAlt = TY_IMPERATIVES.map((p) => bothCase(vyForm(p))).join('|');

// Экспорт ради second-person.spec.ts — пинит каждый паттерн живым образцом
// (как PATTERNS в check-robot-phrases.mjs/check-gendered-forms.mjs).
export const PATTERNS = [
  [
    'pronoun-ty',
    new RegExp(
      `${L}(?:[Тт]ы|[Тт]ебя|[Тт]ебе|[Тт]обой|[Тт]во(?:его|ему|ими|ей|им|их|ой|ую|й|я|ё|е|и|ю))${R}`,
      'g',
    ),
  ],
  [
    'pronoun-vy',
    new RegExp(
      `${L}(?:[Вв]ы|[Вв]ас|[Вв]ам|[Вв]ами|[Вв]аш(?:его|ему|ими|ей|им|их|у|а|е|и)?)${R}`,
      'g',
    ),
  ],
  ['imperative-ty', new RegExp(`${L}(?:${tyAlt})${R}`, 'g')],
  ['imperative-vy', new RegExp(`${L}(?:${vyAlt})${R}`, 'g')],
];

// Вилки форм: значение легитимно, если живёт внутри аргументов tr(...)/
// pickForm(...)/t(...). Вилки многострочные (prettier переносит аргументы),
// поэтому построчная проверка не годится — вырезаем аргументы целиком,
// балансируя скобки и не считая скобки внутри строковых литералов (та же
// схема, что в check-address-form.mjs; дублируется намеренно — гейты обязаны
// быть однофайловыми, см. gate-sandbox.ts).
const FORK_OPEN_RE = /(?<![\p{L}\p{N}_$.])(tr|pickForm|t)\(/gu;

function blankForkArgs(src) {
  let out = '';
  let last = 0;
  FORK_OPEN_RE.lastIndex = 0;
  let m;
  while ((m = FORK_OPEN_RE.exec(src)) !== null) {
    const argStart = m.index + m[0].length;
    if (argStart <= last) continue; // вложенная вилка внутри уже вырезанной
    let depth = 1;
    let quote = null;
    let i = argStart;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    out += src.slice(last, argStart);
    out += src.slice(argStart, i).replace(/[^\n]/g, ' '); // переводы строк сохраняем
    last = i;
    FORK_OPEN_RE.lastIndex = i;
  }
  return out + src.slice(last);
}

// Дословные внутренние цитаты («…», «…») — межличностная речь и
// самоподдержка, правило CLAUDE.md сохраняет их регистр как есть, они не
// обязаны идти через tr(). Вырезаем содержимое кавычек так же, как вырезаем
// аргументы вилки — построчную нумерацию не ломаем.
function blankQuotedSpans(src) {
  return src
    .replace(/«[^»]*»/g, (s) => s.replace(/[^\n]/g, ' '))
    .replace(/“[^”]*”/g, (s) => s.replace(/[^\n]/g, ' '));
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
      if (name === 'node_modules' || name === 'dist' || name === 'game') continue;
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
    const scanned = blankForkArgs(blankQuotedSpans(raw));
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
