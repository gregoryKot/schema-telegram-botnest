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
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PATTERNS } from './robot-phrases-patterns.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'robot-phrases-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];

// Статика вне `src/` — та же слепая зона, что закрывал гейт публичных
// скриптов (правило №14): её не импортирует ни один модуль, поэтому ни один
// гейт в неё не смотрел. Именно там самоназвание «Консультант по
// схема-терапии» (JSON-LD) и «Сайт специалиста по психологическому
// консультированию» (llms.txt) прожили свип 2026-09 и нашлись ручной
// вычиткой владельца, а не проверкой.
const SCAN_FILES = ['webapp/index.html', 'webapp/public/llms.txt'];

// Юридические документы — отдельный жанр: «является публичной офертой» и
// «обработка осуществляется в соответствии с 152-ФЗ» юридически точны, живым
// языком их переписывать нельзя (docs/VOICE.md). Экспорт — ради теста гейта.
export const EXCLUDED = new Set([
  'webapp/src/pages/OfferPage.tsx',
  'webapp/src/pages/PrivacyPage.tsx',
]);

// «Это не X, это Y» — не запрещённая конструкция целиком, а пустая ЕЁ форма
// (docs/VOICE.md: «работает, только когда вторая часть даёт новое»). Гейт не
// умеет отличать удачное употребление от пустого, поэтому удачные образцы
// допускаются точечно — по конкретной фразе, а не по файлу или паттерну
// целиком (иначе следующая пустая фраза в том же файле проскочит бесшумно).
export const ALLOW = [
  // Эталонный пример из самого VOICE.md («Работает: „Это не каприз, это
  // счётчик“ — счётчик добавляет образ и логику»). Гейт засчитывал нарушением
  // текст, который стайл-гайд приводит как образец правильного употребления.
  /[Ээ]то\s+не\s+каприз,\s*это\s+счётчик/,
  // «это не факт, это схема» (modeCheckinData.ts, режим «Униженный Ребёнок»):
  // вторая часть называет конкретный клинический концепт схема-терапии —
  // объясняет МЕХАНИЗМ стыда («со мной что-то не так» — не факт, а старая
  // схема), а не пересказывает первую часть другими словами. Тот же критерий,
  // что у примера выше.
  /[Ээ]то\s+не\s+факт,\s*это\s+схема/,
  // «Я психолог — подать заявку»: кнопка, которой СПЕЦИАЛИСТ заявляет о своей
  // квалификации, чтобы получить роль терапевта (webapp/src/pages/account/
  // TherapistRequestSection.tsx и двойник в мини-аппе). Это чужая реплика о
  // себе, а не самоназвание автора — паттерн samonazvanie-avtora её задевать
  // не должен. Контрольный образец в robot-phrases.spec.ts проверяет, что
  // похожая, но НЕзаконная «Я психолог, работаю в подходе…» по-прежнему
  // краснеет.
  /[Яя]\s+психолог\s+—\s+подать\s+заявку/,
  // Та же кнопка, названная в кавычках из другого места («Настройки → "Я
  // психолог"» в боте и в 410-ответе become-therapist): это ссылка на элемент
  // интерфейса, а не утверждение о чьей-то квалификации. Кавычки обязательны —
  // без них запись погасила бы и самоназвание автора.
  /[«"„]Я\s+психолог[»"“]/,
];

// PATTERNS — в robot-phrases-patterns.mjs (правило №10: движок не растёт
// вместе со списком правил, образец — gendered-forms-patterns.mjs).

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

// CLI-логика — только при запуске как скрипт (не при импорте PATTERNS).
function main() {
  const counts = {};
  const details = {};
  const scanned = [...SCAN_DIRS.flatMap((dir) => walk(dir)), ...SCAN_FILES];
  for (const file of scanned) {
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
      // ALLOW гасит только свой фрагмент, а не всю строку: иначе одна
      // законная конструкция прячет соседнее нарушение в той же строке
      // (тот же приём, что в check-gendered-forms.mjs).
      const scan = ALLOW.reduce(
        (acc, a) =>
          acc.replace(
            new RegExp(a.source, a.flags.replace('g', '') + 'g'),
            ' ',
          ),
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
        '[predlog-vse-po-skheme] — перед «Всё по схеме» пишется «во»/«ко».\n' +
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
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
