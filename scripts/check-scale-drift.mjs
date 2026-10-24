#!/usr/bin/env node
// Храповик инлайновых borderRadius/отступов ВНЕ шкалы токенов (дизайн-аудит
// 2026-08, В11, волна «порядок» — шкала описана и обоснована частотами в
// shared/src/theme/tokens.css: --r-2…--r-20, --space-2…--space-48).
//
// Механизм принуждения к правилу №10/В11 CLAUDE.md: без гейта шкала —
// просто комментарий, который никто не обязан соблюдать, и следующий PR
// снова напишет `borderRadius: 15` или `padding: 17` не задумываясь. Гейт
// по образцу check-tiny-fonts.mjs — пофайловый храповик, новый файл
// рождается с нулём, существующий может только уменьшаться.
//
// Что считается «дрейфом»: голое числовое `borderRadius:`/`padding*:`/
// `margin*:`/`gap:` (без var(), без строки-шаблона), значение которого НЕ
// входит в шкалу. Не считается дрейфом (сознательные исключения):
//   - 0 — «нет отступа/радиуса», не шаг шкалы, а сброс;
//   - отрицательные margin — приём «выпуска за край» (bleed), для него нет
//     и не должно быть отрицательного токена;
//   - «полностью круглое» — 100/999/9999 и '50%' (пилюли/аватары, не радиус
//     в пиксельном смысле шкалы; '50%' и так не матчится числовым regex).
// Составные значения ('12px 16px', "8px 0 4px 0") НЕ разбираются — тот же
// осознанный компромисс, что в самой волне миграции (не гонимся за 100%
// синтаксисов, ловим однозначный случай). Тест гейта — scale-drift.spec.ts.
//
// Снизил — зафиксируй: node scripts/check-scale-drift.mjs --update
// Что именно насчитано: node scripts/check-scale-drift.mjs --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'scale-drift-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

// Шкала — shared/src/theme/tokens.css (частоты замеров там же).
const RADIUS_SCALE = new Set([2, 4, 6, 8, 10, 12, 14, 16, 20]);
const SPACE_SCALE = new Set([
  2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48,
]);
// «Полностью круглое» — не радиус в пиксельном смысле шкалы.
const FULL_ROUND = new Set([100, 999, 9999]);

const SPACE_PROPS = [
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'gap',
  'rowGap',
  'columnGap',
];

// Голое числовое значение сразу перед запятой/закрывающей скобкой — та же
// форма, что искала и чинила сама волна миграции. Строки ('14px', '12px
// 16px'), var(), шаблонные литералы и составные значения не матчатся —
// осознанно (см. комментарий выше).
const RADIUS_RE = /\bborderRadius:\s*(-?\d+(?:\.\d+)?)\b(\s*[,}])/g;
const SPACE_RE = new RegExp(
  '\\b(' +
    SPACE_PROPS.join('|') +
    '):\\s*(-?\\d+(?:\\.\\d+)?)\\b(\\s*[,}])',
  'g',
);

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
  src.split('\n').forEach((line, i) => {
    RADIUS_RE.lastIndex = 0;
    let m;
    while ((m = RADIUS_RE.exec(line))) {
      const val = parseFloat(m[1]);
      if (val === 0 || val < 0) continue;
      if (FULL_ROUND.has(val)) continue;
      if (!RADIUS_SCALE.has(val)) {
        hits.push(`  L${i + 1} borderRadius: ${m[1]}`);
      }
    }
    SPACE_RE.lastIndex = 0;
    while ((m = SPACE_RE.exec(line))) {
      const prop = m[1];
      const val = parseFloat(m[2]);
      if (val === 0 || val < 0) continue; // 0 и bleed-отрицательные — не дрейф
      if (!SPACE_SCALE.has(val)) {
        hits.push(`  L${i + 1} ${prop}: ${m[2]}`);
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
      `Бейслайн обновлён: ${total} значений вне шкалы в ${Object.keys(counts).length} файлах.`,
    );
    process.exit(0);
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — сгенерируй: node scripts/check-scale-drift.mjs --update',
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
    console.error('❌ Храповик значений вне шкалы: стало хуже.\n');
    for (const [file, was, now] of grown) {
      console.error(`  ${file}: ${was} → ${now}`);
      for (const d of details[file] || []) console.error(d);
    }
    for (const [file, n] of born) {
      console.error(`  ${file}: новый файл с ${n} значениями вне шкалы (допустимо 0)`);
      for (const d of details[file] || []) console.error(d);
    }
    console.error(
      '\nШкала — shared/src/theme/tokens.css (--r-*, --space-*), обоснование\n' +
        'ступеней там же. Новое значение обязано либо попасть в существующую\n' +
        'ступень, либо (если это правда новый устойчивый паттерн) стать поводом\n' +
        'пересчитать шкалу, а не тихо остаться литералом.\n' +
        'Бейслайн обновляется только вниз: node scripts/check-scale-drift.mjs --update',
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
      ? `✓ Храповик значений вне шкалы: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-scale-drift.mjs --update`
      : `✓ Храповик значений вне шкалы: ${total} (без роста)`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
