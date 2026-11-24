#!/usr/bin/env node
// Шкала радиусов сайта (#1619, решение 3): журнальный стиль вместо iOS-капсул.
//   • карточки и блоки — не круглее 16px (литерал ≤16 или var(--r-N));
//   • var(--r-20) — только верхние углы листа: `var(--r-20) var(--r-20) 0 0`;
//   • капсула var(--r-pill) — только у чипов (правила — check-radius-scale-rules.mjs);
//     литерал 999/9999/100px не пишется вовсе.
// Смотрит border-radius в .css и borderRadius / radius={N} в .ts/.tsx (webapp/src, shared/src).
// Абсолютный, без бейслайна: замены сделаны целиком, замораживать нечему.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import {
  EXEMPT,
  EXEMPT_SELECTORS,
  CHIP_SELECTOR,
  CHIP_ALLOW,
  INLINE_PILL_ALLOW,
  MAX_PX,
} from './check-radius-scale-rules.mjs';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = ['webapp/src', 'shared/src'];
const TOP_20 = /^var\(--r-20\)\s+var\(--r-20\)\s+0(px)?\s+0(px)?$/;

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir)).filter((n) => !n.startsWith('.'));
  } catch {
    return acc;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist') walk(rel, acc);
      continue;
    }
    if (/\.(spec|test)\.(ts|tsx)$/.test(name) || name.endsWith('.d.ts')) continue;
    if (/\.(ts|tsx|css)$/.test(name)) acc.push(rel);
  }
  return acc;
}

const bigPx = (v) => (v.match(/(\d+(?:\.\d+)?)px/g) ?? []).some((p) => parseFloat(p) > MAX_PX);

/** Причина нарушения для значения радиуса или null. */
function judge(value, { prop = 'border-radius', isChip, pillOk }) {
  const v = value.trim();
  if (bigPx(v)) return `литерал круглее ${MAX_PX}px — var(--r-16) и ниже, у чипа var(--r-pill)`;
  if (/var\(--r-20\)/.test(v) && !TOP_20.test(v) && !/^border-top-(left|right)-radius$/.test(prop))
    return 'var(--r-20) — только верхние углы листа: var(--r-20) var(--r-20) 0 0';
  if (/var\(--r-pill\)/.test(v) && !(isChip || pillOk)) return 'капсула var(--r-pill) — только у чипов';
  return null;
}

function lineAt(text, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function scanCss(text) {
  const hits = [];
  const css = stripComments(text, true);
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (EXEMPT_SELECTORS.has(sel)) continue;
    const isChip = CHIP_SELECTOR.test(sel) || sel.split(',').some((s) => CHIP_ALLOW.has(s.trim()));
    const bodyAt = m.index + m[1].length + 1;
    for (const d of m[2].matchAll(/(border(?:-[a-z]+)*-radius)\s*:\s*([^;]+)/g)) {
      const why = judge(d[2], { prop: d[1], isChip, pillOk: false });
      if (why) hits.push({ ln: lineAt(css, bodyAt + d.index), hit: `${sel} { ${d[0].trim()} }`, why });
    }
  }
  return hits;
}

function scanTs(text, file) {
  const hits = [];
  const pillOk = INLINE_PILL_ALLOW.has(file);
  stripComments(text, false)
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(/\b(border\w*Radius)\s*:\s*(\d+(?:\.\d+)?|'[^']*'|"[^"]*")/g)) {
        const raw = m[2].replace(/^['"]|['"]$/g, '');
        const v = /^\d+(\.\d+)?$/.test(raw) ? `${raw}px` : raw;
        const why = judge(v, { isChip: false, pillOk });
        if (why) hits.push({ ln: i + 1, hit: m[0], why });
      }
      for (const m of line.matchAll(/\bradius=(?:\{(\d+(?:\.\d+)?)\}|['"](\d+(?:\.\d+)?)(?:px)?['"])/g)) {
        if (parseFloat(m[1] ?? m[2]) > MAX_PX) hits.push({ ln: i + 1, hit: m[0], why: `скелетон круглее ${MAX_PX}px — форма контента ≤16` });
      }
    });
  return hits;
}

function main() {
  const found = [];
  const skipped = new Map();
  for (const file of SCAN_DIRS.flatMap((d) => walk(d))) {
    const ex = EXEMPT.find(([, re]) => re.test(file));
    if (ex) {
      skipped.set(ex[0], (skipped.get(ex[0]) ?? 0) + 1);
      continue;
    }
    let src;
    try {
      src = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    const hits = file.endsWith('.css') ? scanCss(src) : scanTs(src, file);
    for (const h of hits) found.push({ file, ...h });
  }

  if (found.length) {
    console.error(`❌ Радиус мимо шкалы: ${found.length}.\n`);
    for (const h of found) console.error(`  ${h.file}:${h.ln} «${h.hit}»\n    ${h.why}`);
    console.error(
      '\nШкала (#1619, решение 3): блоки и карточки ≤16 (var(--r-16) и ниже), верх листа — ' +
        'var(--r-20) var(--r-20) 0 0, капсула var(--r-pill) — только у чипов; круг — 50%.\n' +
        'Новый чип с другим именем — строка в CHIP_ALLOW (scripts/check-radius-scale-rules.mjs) с причиной.',
    );
    process.exit(1);
  }
  const ex = [...skipped].map(([why, n]) => `${n} файл. — ${why}`).join('; ');
  console.log(`✓ радиусы по шкале${ex ? ` (вне шкалы: ${ex})` : ''}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
