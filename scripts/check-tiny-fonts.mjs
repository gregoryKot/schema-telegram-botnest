#!/usr/bin/env node
// Храповик подпороговых inline fontSize (дизайн-аудит 2026-08, пункт В1).
//
// Худший случай на момент аудита — `schema-miniapp/src/sections/today/
// NeedMini.tsx:95: fontSize: 7` — но по обоим фронтендам десятки inline
// `fontSize: N` ниже 11px (нижний читаемый порог даже официальная шкала
// `.text-xs` не опускается ниже 11/11.5). Правило без гейта не работает —
// счётчик заморожен пофайлово и может только падать; новый файл рождается
// с нулём (правило №10/№15 CLAUDE.md).
//
// Снизил — зафиксируй: node scripts/check-tiny-fonts.mjs --update
// Что именно насчитано: node scripts/check-tiny-fonts.mjs --verbose
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'tiny-fonts-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

// Порог: минимум читаемого inline-текста (В1). Значение РАВНОЕ порогу —
// допустимо, ловим только строго меньше.
const MIN_PX = 11;

// Инлайновый `fontSize: N` / `fontSize: 'Npx'` / `fontSize: "N"` — числовое
// значение, не переменная/шаблон/токен (`fontSize: 'var(--x)'` не матчится).
const FONT_SIZE_RE = /fontSize:\s*['"]?(\d+(?:\.\d+)?)/g;

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
    FONT_SIZE_RE.lastIndex = 0;
    let m;
    while ((m = FONT_SIZE_RE.exec(line))) {
      const val = parseFloat(m[1]);
      if (val < MIN_PX) hits.push(`  L${i + 1} fontSize: ${m[1]}`);
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
      `Бейслайн обновлён: ${total} подпороговых fontSize в ${Object.keys(counts).length} файлах.`,
    );
    process.exit(0);
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error(
      'Нет бейслайна — сгенерируй: node scripts/check-tiny-fonts.mjs --update',
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
    console.error('❌ Храповик подпороговых fontSize: стало хуже.\n');
    for (const [file, was, now] of grown) {
      console.error(`  ${file}: ${was} → ${now}`);
      for (const d of details[file] || []) console.error(d);
    }
    for (const [file, n] of born) {
      console.error(`  ${file}: новый файл с ${n} подпороговыми fontSize (допустимо 0)`);
      for (const d of details[file] || []) console.error(d);
    }
    console.error(
      `\nМинимум читаемого inline-текста — ${MIN_PX}px (docs/DESIGN_AUDIT_2026-08.md, В1).\n` +
        'Если элемент узкий и текст не помещается — не увеличивай слепо: сократи\n' +
        'текст, дай перенос, увеличь контейнер, а не оставляй fontSize ниже порога.\n' +
        'Бейслайн обновляется только вниз: node scripts/check-tiny-fonts.mjs --update',
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
      ? `✓ Храповик подпороговых fontSize: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-tiny-fonts.mjs --update`
      : `✓ Храповик подпороговых fontSize: ${total} (без роста)`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
