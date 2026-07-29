#!/usr/bin/env node
// Храповик роботных конструкций в user-facing тексте (свип 2026-07, docs/VOICE.md).
//
// Правила голоса жили в docs/ARTICLES.md и касались только статей — а те же
// конструкции расползлись по всему продукту (в пуле канала «Здоровый Взрослый»
// 18 фраз из 46 были построены на одном скелете «Это не X. Это Y»). Правило без
// гейта не работает, поэтому счётчик заморожен пофайлово и может только падать.
//
// Снизил — зафиксируй, чтобы файл нельзя было снова засорить:
//   node scripts/check-robot-phrases.mjs --update
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'robot-phrases-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];

// Юридические документы — отдельный жанр: «является публичной офертой» и
// «обработка осуществляется в соответствии с 152-ФЗ» юридически точны, живым
// языком их переписывать нельзя (docs/VOICE.md).
const EXCLUDED = new Set([
  'webapp/src/pages/OfferPage.tsx',
  'webapp/src/pages/PrivacyPage.tsx',
]);

const PATTERNS = [
  // Определение через отрицание: «это не X, это Y» / «это не про А, это про B»
  ['eto-ne-eto', /[Ээ]то\s+не\s+[^,.!?;»]{2,60}[,.]\s*(?:[Ээ]то|а)\s/g],
  ['eto-ne-pro', /[Ээ]то\s+не\s+про\s/g],
  ['tire-eto-ne', /[—–]\s*это\s+не\s/g],
  ['ne-prosto', /не\s+просто\s/gi],
  ['ne-znachit', /не\s+значит\s[^.!?]{2,60}[,.]\s*[Ээ]то\s+значит/g],
  // Метатекст
  [
    'metatext',
    /важно\s+(?:отметить|понимать|помнить)|стоит\s+(?:отметить|сказать|учитывать|помнить)|следует\s+(?:отметить|понимать|помнить)|необходимо\s+отметить|в\s+заключение|в\s+конечном\s+итоге/gi,
  ],
  // Канцелярит. Левая граница обязательна: без неё «являет(ся)» ловит
  // «проявляется»/«появляется»/«выявляется», а «производится» —
  // «воспроизводится». \b в JS работает только по ASCII, поэтому lookbehind.
  [
    'kancelyarit',
    /(?<![А-Яа-яЁё])(?:являет(?:ся|ются)|представля(?:ет|ют)\s+собой|осуществля(?:ет|ется|ются|ть)|производится)/gi,
  ],
  // Слова без содержания. «значимые люди» из-под правила выведены: это
  // устоявшийся перевод significant others в описании схемы Покинутости —
  // термин, а не декоративное прилагательное (docs/ARTICLES.md: термин
  // используется точно или не используется).
  [
    'filler',
    /ключев(?:ой|ая|ое|ые|ым|ого|ую)|эффективн(?:ый|ая|ое|ые|ым)|уникальн(?:ый|ая|ое|ые)|значимы(?:й|е)(?!\s+люд)|мощн(?:ый|ое)\s+инструмент|играет\s+(?:важную|ключевую)\s+роль|в\s+современном\s+мире/gi,
  ],
  // Служебные мостики между абзацами
  [
    'bridges',
    /таким\s+образом|однако\s+стоит|при\s+этом\s+важно|тем\s+не\s+менее|в\s+связи\s+с\s+этим|в\s+свою\s+очередь/gi,
  ],
  // Симметрия ради баланса
  ['symmetry', /с\s+одной\s+стороны/gi],
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
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.(ts|tsx)$/.test(name)) {
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
      if (!/[А-Яа-я]{4}/.test(line)) return; // только строки с русским текстом
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // комментарии — не user-facing
      for (const [name, re] of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
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
    `Бейслайн обновлён: ${total} конструкций в ${Object.keys(counts).length} файлах.`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна — сгенерируй: node scripts/check-robot-phrases.mjs --update',
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
  console.error('❌ Храповик роботных конструкций: стало хуже.\n');
  for (const [file, was, now] of grown) {
    console.error(`  ${file}: ${was} → ${now}`);
    for (const d of details[file] || []) console.error(d);
  }
  for (const [file, n] of born) {
    console.error(`  ${file}: новый файл с ${n} конструкциями (допустимо 0)`);
    for (const d of details[file] || []) console.error(d);
  }
  console.error(
    '\nЧто это значит — docs/VOICE.md: определение через отрицание,\n' +
      'канцелярит, слова-филлеры и служебные мостики в тексте, который видит\n' +
      'пользователь. Перепиши утвердительно.\n' +
      'Бейслайн обновляется только вниз: node scripts/check-robot-phrases.mjs --update',
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
    ? `✓ Храповик роботных конструкций: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-robot-phrases.mjs --update`
    : `✓ Храповик роботных конструкций: ${total} (без роста)`,
);
