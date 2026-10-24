#!/usr/bin/env node
// Храповик захардкоженных хроматических цветовых литералов во фронтендах.
//
// PR #516 перевёл ~40 захардкоженных цветов на токены/color-mix (в тёмной
// теме белый на `rgba(239,68,68,0.08)` давал контраст 2.78:1 при норме
// 4.5:1 — подложка была выверена на светлой бумаге и в тёмной осталась
// светлой), но у класса не было механизма: следующий PR снова написал бы
// hex/rgb мимо палитры. Гейт по образцу check-tiny-fonts.mjs — пофайловый
// храповик, новый файл рождается с нулём, существующий может только
// уменьшаться.
//
// Что считается «дрейфом»: голый hex (`#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`)
// или `rgb()`/`rgba()` с числовыми каналами вне комментариев/исключений.
//
// Ахроматика (r===g===b — оттенки серого и чёрный/белый с альфой) НЕ
// считается: `rgba(0,0,0,…)`/`rgba(255,255,255,…)`/серые — тени и
// затемняющие подложки, законный приём. Цвет ПРОДУКТА задают токены, а
// серый цветом продукта не является.
//
// Снизил — зафиксируй: node scripts/check-color-drift.mjs --update
// Что именно насчитано: node scripts/check-color-drift.mjs --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'color-drift-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

// Ровно валидные CSS-hex длины (3/4/6/8 цифр) — 5 и 7 цифр цветом не бывают,
// а номера PR (`#516`) гасит уже вырезание комментариев. Держим длины
// валидными, чтобы случайное слово из hex-букв (`#faded`) не считалось
// цветом.
const HEX_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
// Только числовые каналы: `rgba(var(--fg-rgb),0.1)` не матчится по
// построению — это и нужно, переменная не литерал.
const RGB_RE = /\brgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;

// Официальные брендовые цвета сторонних площадок (логотипы Google/Telegram/
// VK в кнопках входа и в списке провайдеров) — бренд чужой площадки нельзя
// заменить нашим токеном, он перестанет быть узнаваемым. Сравнение ниже —
// ПО ЗНАЧЕНИЮ, а не по файлу: любой другой (не брендовый) литерал в этих же
// файлах по-прежнему считается дрейфом.
export const ALLOW_BRAND_COLORS = [
  '#4285F4', // Google
  '#34A853', // Google
  '#FBBC05', // Google
  '#EA4335', // Google
  '#2AABEE', // Telegram
  '#229ED9', // Telegram
  '#29B6F6', // Telegram
  '#0077FF', // VK
];

// Файлы, где hex приходит только значением, а не может прийти токеном.
export const EXCLUDE_FILES = [
  // Рисование карточек шаринга на canvas — CSS-переменных в canvas-контексте
  // нет, цвет туда приходит только значением.
  'shared/src/share/',
  // То же canvas-рисование (конфетти).
  'shared/src/hooks/useConfetti.ts',
  // Намеренно отдельная маркетинговая айдентика, не зависящая от app-темы
  // (см. шапку самого файла).
  'webapp/src/pages/landing/aurora.ts',
];

// Парная запись `css: 'var(--…)', hex: '#…'` в shared/src/journey/journeyMeta.ts:
// hex здесь — ПАРА к токену для canvas, источник истины рядом в той же
// строке. Одинокий `hex:` без пары по-прежнему считается дрейфом.
export const EXCLUDE_LINE_PATTERNS = [
  /\bcss:\s*'var\(--[\w-]+\)',\s*hex:\s*'#[0-9a-fA-F]{3,8}'/,
];

const BRAND_COLOR_KEYS = new Set(
  ALLOW_BRAND_COLORS.map((h) => hexToRgbKey(h)),
);

function hexToRgbKey(hex) {
  const digits = hex.replace('#', '');
  let r, g, b;
  if (digits.length === 3 || digits.length === 4) {
    r = digits[0] + digits[0];
    g = digits[1] + digits[1];
    b = digits[2] + digits[2];
  } else {
    r = digits.slice(0, 2);
    g = digits.slice(2, 4);
    b = digits.slice(4, 6);
  }
  return `${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)}`;
}

function isExcludedFile(file) {
  return EXCLUDE_FILES.some((entry) => file === entry || file.startsWith(entry));
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
      if (name === 'node_modules' || name === 'dist') continue;
      walk(rel, acc);
    } else if (
      /\.(ts|tsx)$/.test(name) &&
      !/\.(spec|test)\.(ts|tsx)$/.test(name) &&
      !name.endsWith('.d.ts')
    ) {
      acc.push(rel);
    }
  }
  return acc;
}

function scanFile(src) {
  const hits = [];
  stripComments(src, false)
    .split('\n')
    .forEach((line, i) => {
      if (EXCLUDE_LINE_PATTERNS.some((re) => re.test(line))) return;

      HEX_RE.lastIndex = 0;
      let m;
      while ((m = HEX_RE.exec(line))) {
        const literal = `#${m[1]}`;
        const key = hexToRgbKey(literal);
        const [r, g, b] = key.split(',').map(Number);
        if (r === g && g === b) continue; // ахроматика
        if (BRAND_COLOR_KEYS.has(key)) continue; // официальный бренд площадки
        hits.push(`  L${i + 1} ${literal} — ${line.trim().slice(0, 90)}`);
      }

      RGB_RE.lastIndex = 0;
      while ((m = RGB_RE.exec(line))) {
        const r = Number(m[1]);
        const g = Number(m[2]);
        const b = Number(m[3]);
        if (r === g && g === b) continue; // ахроматика
        const key = `${r},${g},${b}`;
        if (BRAND_COLOR_KEYS.has(key)) continue;
        // Регэксп кончается на третьем канале — в отчёт берём литерал
        // целиком, до закрывающей скобки: `rgba(239,68,68,0.08)` читается,
        // а обрубок `rgba(239,68,68` заставляет лезть в файл глазами.
        const close = line.indexOf(')', m.index);
        const literal = close === -1 ? m[0] : line.slice(m.index, close + 1);
        hits.push(`  L${i + 1} ${literal} — ${line.trim().slice(0, 90)}`);
      }
    });
  return hits;
}

function main() {
  const counts = {};
  const details = {};
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      if (isExcludedFile(file)) continue;
      let src;
      try {
        src = readFileSync(join(ROOT, file), 'utf8');
      } catch {
        continue;
      }
      const hits = scanFile(src);
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
      `Бейслайн обновлён: ${total} цветовых литералов в ${Object.keys(counts).length} файлах.`,
    );
    process.exit(0);
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — сгенерируй: node scripts/check-color-drift.mjs --update',
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
    console.error('❌ Храповик цветовых литералов: стало хуже.\n');
    for (const [file, was, now] of grown) {
      console.error(`  ${file}: ${was} → ${now}`);
      for (const d of details[file] || []) console.error(d);
    }
    for (const [file, n] of born) {
      console.error(`  ${file}: новый файл с ${n} цветовыми литералами (допустимо 0)`);
      for (const d of details[file] || []) console.error(d);
    }
    console.error(
      '\nЦвет продукта живёт в палитре (shared/src/theme/tokens.css + index.css\n' +
        'обоих фронтендов), а не в style-объекте: литерал не меняется темой —\n' +
        'подложка, выверенная на светлой бумаге, в тёмной остаётся светлой (так в\n' +
        'тёмной теме белый на красном давал 2.78:1 при норме 4.5:1, PR #516).\n' +
        'Прозрачную версию токена берут color-mix(in srgb, var(--accent-red) 8%,\n' +
        'transparent), а не rgba(239,68,68,0.08).\n' +
        'Бейслайн обновляется только вниз: node scripts/check-color-drift.mjs --update',
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
      ? `✓ Храповик цветовых литералов: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-color-drift.mjs --update`
      : `✓ Храповик цветовых литералов: ${total} (без роста)`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
