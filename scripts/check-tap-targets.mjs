#!/usr/bin/env node
// Храповик мелких тап-целей (правило «Онбординг и очевидность» CLAUDE.md:
// «достаточные зоны нажатия, цель ≥ 44×44»; дизайн-аудит 2026-08, пункт К3).
//
// Аудит нашёл системные промахи, их починили (#397) — а гейта не оставили, и
// класс вернулся: `hitboxStyle` (shared/src/utils/hitbox.ts) использован 7 раз,
// все в schema-miniapp, в webapp/src — ни разу. Пофайловый храповик (формат —
// check-tiny-fonts.mjs): счётчик может только падать, новый файл — с нулём.
// Считается ОДИН случай, если в открывающем JSX-теге интерактивный элемент
// (`<button`, onClick, role=button/checkbox/slider) задаёт инлайн-стилем ЧИСЛАМИ
// и ширину, и высоту — обе строго меньше 44 — и не проходит через `hitboxStyle`
// (разбор тега — scripts/tap-targets-rules.mjs).
//
// СОЗНАТЕЛЬНО не считается — промах по ОДНОЙ стороне. Кнопка во всю ширину с
// `padding: '8px 0'` (высота ~33) в счётчик не входит: иначе он уходит в сотни,
// и настоящий класс (мелкая иконка-квадратик 20×20, до которой не попасть
// пальцем) в нём тонет, а гейт, которому не верят, отключают (правило №15).
// Образец правильной узкой шкалы — schema-miniapp/src/components/NeedRatingBar.tsx:
// `flex: 1` + `padding: '17px 0'` → 46px по высоте при ~30 по ширине.
// Не считаются значения-не-числа (`'var(--x)'`, `'100%'`, переменные) и стили вне
// инлайна (`style={styles.btn}`): их размер статически неизвестен.
//
// Снизил — зафиксируй: node scripts/check-tap-targets.mjs --update
// Что именно насчитано: node scripts/check-tap-targets.mjs --verbose
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { findTapTargets, MIN_TARGET_PX } from './tap-targets-rules.mjs';
import { stripComments } from './gate-strip-comments.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'tap-targets-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

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
    } else if (/\.tsx$/.test(name) && !/\.(spec|test)\.tsx$/.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

function main() {
  const counts = {};
  const details = {};
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      const hits = findTapTargets(stripComments(src, false)).map(
        (h) => `  L${h.line} <${h.tag}> ${h.w}×${h.h}`,
      );
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
    console.log(
      `Бейслайн обновлён: ${sum(counts)} мелких тап-целей в ${Object.keys(counts).length} файлах.`,
    );
    process.exit(0);
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error('Нет бейслайна — сгенерируй: node scripts/check-tap-targets.mjs --update');
    process.exit(1);
  }

  const grown = [];
  const born = [];
  for (const [file, n] of Object.entries(counts)) {
    const was = baseline[file];
    if (was === undefined) born.push([file, n]);
    else if (n > was) grown.push([file, was, n]);
  }
  // Протухшая запись: файла больше нет (удалён/переименован) — сигнал «сверься».
  const stale = Object.keys(baseline).filter((f) => !existsSync(join(ROOT, f)));

  if (grown.length || born.length || stale.length) {
    console.error('❌ Храповик мелких тап-целей: стало хуже.\n');
    for (const [file, was, now] of grown) {
      console.error(`  ${file}: ${was} → ${now}`);
      for (const d of details[file] || []) console.error(d);
    }
    for (const [file, n] of born) {
      console.error(`  ${file}: новый файл с ${n} мелкими тап-целями (допустимо 0)`);
      for (const d of details[file] || []) console.error(d);
    }
    for (const file of stale) {
      console.error(
        `  ${file}: запись протухла — файла больше нет (удалён или переименован).\n` +
          '    Сверься, что тап-цели не уехали в другой файл, и сними запись:\n' +
          '    node scripts/check-tap-targets.mjs --update',
      );
    }
    if (grown.length || born.length) {
      console.error(
        `\nКнопка или иконка с шириной и высотой меньше ${MIN_TARGET_PX}px — до неё трудно попасть пальцем\n` +
          '(правило «Онбординг и очевидность» CLAUDE.md, дизайн-аудит 2026-08, К3).\n' +
          'Оберни через `hitboxStyle` из shared/src/utils/hitbox.ts (визуальный размер\n' +
          `не меняется, зона нажатия растёт до ${MIN_TARGET_PX}×${MIN_TARGET_PX}) либо подними размер до ${MIN_TARGET_PX}.\n` +
          'Бейслайн обновляется только вниз: node scripts/check-tap-targets.mjs --update',
      );
    }
    process.exit(1);
  }

  const baseTotal = sum(baseline);
  const total = sum(counts);
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
      ? `✓ Храповик мелких тап-целей: ${total} < ${baseTotal} — стало лучше, зафиксируй: node scripts/check-tap-targets.mjs --update`
      : `✓ Храповик мелких тап-целей: ${total} (без роста)`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
