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
// Снизил счётчик — зафиксируй, чтобы файл нельзя было засорить снова:
//   node scripts/check-gendered-forms.mjs --update
// Посмотреть, что именно насчитано: --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'gendered-forms-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];

// \b в JS считает границей только ASCII, поэтому границы слова для кириллицы
// приходится задавать lookaround'ами.
const L = '(?<![А-Яа-яЁё])';
const R = '(?![А-Яа-яЁё])';
// «ог/ёг» намеренно НЕ здесь: они ловят существительные («я психолог»,
// «диалог»). Неправильные формы на согласный — отдельным списком ниже.
const PAST_M = '(?:ал|ял|ил|ел|ыл|ёл|ул|рос|ался|ился|ялся|улся|ёлся)';
const FILLER = '(?:не\\s+|бы\\s+|уже\\s+|сам\\s+|тогда\\s+|сегодня\\s+|снова\\s+|всё\\s+ещё\\s+)*';

const PATTERNS = [
  // «ты сделал», «ты бы остался», «ты вернулся»
  ['ty-past', new RegExp(`${L}[Тт]ы\\s+${FILLER}[а-яё]+${PAST_M}${R}`, 'g')],
  ['bud-ty-past', new RegExp(`${L}бы\\s+ты\\s+${FILLER}[а-яё]+(?:л|лся|рос)${R}`, 'g')],
  ['ty-irregular', new RegExp(`${L}[Тт]ы\\s+${FILLER}(?:вырос|подрос|смог|мог|лёг|нёс|привык)${R}`, 'g')],
  // «ты не обязан», «ты готов», «ты живой»
  [
    'ty-short-adj',
    new RegExp(
      `${L}[Тт]ы\\s+${FILLER}(?:обязан|должен|готов|уверен|рад|спокоен|виноват|прав|свободен|живой|один)${R}`,
      'g',
    ),
  ],
  // Реплики от первого лица, которые пользователь произносит или примеряет
  // к себе: «скажи "я устал"», «ругаю себя: я плохой».
  [
    'ya-past',
    new RegExp(`${L}[Яя]\\s+${FILLER}[а-яё]+${PAST_M}${R}`, 'g'),
  ],
  [
    'ya-short-adj',
    new RegExp(
      `${L}[Яя]\\s+${FILLER}(?:рад|устал|плохой|виноват|должен|готов|один|слаб|сломан|недостоин|достоин|обязан|ценен)${R}`,
      'g',
    ),
  ],
  // «позволь себе быть сильным», «стать удобным», «оставаться спокойным»
  [
    'inf-adj-m',
    new RegExp(
      `${L}(?:быть|стать|казаться|остаться|оставаться|чувствовать\\s+себя)\\s+(?:чуть-чуть\\s+)?(?:не\\s+)?[а-яё]+(?:ым|им)${R}`,
      'g',
    ),
  ],
  // Читатель, названный уменьшительным прилагательным как существительным:
  // «Дорогой маленький я», «сказать себе-маленькому», «как маленькому,
  // которого не обнимали», «внутри — маленький и уязвимый». Прилагательное
  // при существительном («маленький шаг», «как ребёнку, которого») — законно
  // и сюда намеренно не попадает.
  [
    'child-self-m',
    new RegExp(
      `${L}(?:[Мм]аленьк(?:ий|ая)\\s+я${R}` +
        `|себе[-\\s]маленьк(?:ому|им)` +
        `|как\\s+маленьк(?:ому|им)\\s*[,.—–]` +
        `|—\\s*маленьк(?:ий|ая)\\s+и\\s+[а-яё]+(?:ый|ий|ая))`,
      'g',
    ),
  ],
  // Мужское прошедшее с ОПУЩЕННЫМ подлежащим — рассказ читателя о себе, где
  // «я»/«ты» не написано, и потому предыдущие правила его не видят:
  // «Научился прятать», «Выучил одно правило», «Привык молчать». Ловим только
  // глаголы научения/привыкания и только в начале фразы (после точки, тире,
  // двоеточия или открывающей кавычки) — при явном подлежащем («Критик
  // перестал», «отец привык») род принадлежит ему и правило молчит.
  [
    'dropped-subject-past',
    new RegExp(
      `(?:^|[.!?—:]\\s+|[«"'(]\\s*)` +
        `(?:научился|выучил|усвоил|привык|запомнил|приучился|разучился|перестал)${R}`,
      'gi',
    ),
  ],
  // Скобочный костыль вместо живой формулировки: «сделал(а)», «должен(на)»
  ['brackets', new RegExp(`${L}[а-яё]+\\((?:а|на|ла|ась|ой|ая)\\)`, 'g')],
];

// Строки, где мужской род принадлежит не читателю, а другому существительному
// («живой человек», «стабильный взрослый»), либо автору сайта, который пишет
// о себе. Это законный мужской род — его переписывать нечего.
const ALLOW = [
  /живой\s+(?:человек|контакт)/i,
  /(?:оказывался|стабильный|здоровый|Здоровый|рядом)\s+взрослый/i,
  /Клиент\s+должен/i,
  /кто\s+должен\s+быть\s+близким/i,
  /нужно\s+любому/i,
  /который\s+я\s+создал|я\s+схема-терапевт\s+и\s+сделал/i,
  /что\s+он\s+важен/i,
  /кто\s+готов\s+слушать/i,
];

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
