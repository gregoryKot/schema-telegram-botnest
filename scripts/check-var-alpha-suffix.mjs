#!/usr/bin/env node
// Hex-суффикс альфы, дописанный к var() (PR #520).
//
// `#c46b6b18` — рабочий приём: у hex-цвета последние две цифры это альфа.
// `var(--c-rose)18` — не приём, а поломка: var() подставляется ПОСЛЕ
// парсинга, значение становится невалидным «на этапе вычисления» (invalid
// at computed-value time), и браузер берёт НАЧАЛЬНОЕ значение свойства, а
// не то, что стоит ниже в каскаде. Ошибки в консоли нет, строка в DevTools
// выглядит живой — поэтому класс прожил незамеченным неизвестно сколько.
//
// «Просто не рисуется» — не единственный исход. Замерено в живом Chromium:
//   background: var(--c-amber)08      → rgba(0,0,0,0). Подложки нет, и
//     вместе с ней пропадает background: var(--surface) из класса
//     .aside-card: карточка теряет и тонировку, и собственный фон.
//   border-color: var(--c-moss)40     → rgb(107,129,86) сверху и снизу,
//     rgb(0,0,64) слева и справа. Рамка не исчезает, а становится кривой.
//   border: 1px solid var(--c-moss)33 → шорткат невалиден целиком:
//     border-style: none, border-width: 0 — рамки нет совсем.
//
// Принятый в проекте приём для прозрачной версии токена —
// color-mix(in srgb, var(--токен) N%, transparent).
//
// Гейт АБСОЛЮТНЫЙ, без бейслайна (как check-address-agreement.mjs): PR #520
// вычистил класс полностью, замораживать нечему. Гейт без замороженного
// долга сильнее — нет ложного долга и нечего молча поднять через --update
// (правило №15 CLAUDE.md).
//
// Отдельный скрипт, а не ветка в check-color-drift.mjs: там соседний, но
// ДРУГОЙ класс (хроматический литерал мимо палитры — цвет рабочий, просто
// не из токена), другой механизм (пофайловый храповик против абсолютного
// запрета) и другая область (.ts/.tsx против .ts/.tsx/.css). Плюс тот файл
// — 251 строка при потолке 300 (правило №10).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';

const ROOT = join(import.meta.dirname, '..');

// .css обязателен: тот же класс возможен в webapp/src/index.css, а до сих
// пор туда смотрел не каждый гейт (check-color-drift.mjs — только .ts/.tsx).
const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return acc;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(rel, acc);
      continue;
    }
    // Спеки пропускаем: `var(--c-rose)18` внутри теста — это фикстура, на
    // которой проверяют сам гейт (тот же урок, что в
    // check-address-agreement.mjs: без исключения тест на гейт ронял гейт).
    if (/\.(spec|test)\.(ts|tsx)$/.test(name) || name.endsWith('.d.ts'))
      continue;
    if (/\.(ts|tsx|css)$/.test(name)) acc.push(rel);
  }
  return acc;
}

/**
 * Ищет `var(…)`, к закрывающей скобке которого вплотную приклеен hex-символ.
 *
 * Скобки считаются балансом, а не регэкспом: базовый
 * `var\(--[a-zA-Z0-9-]+\)[0-9a-fA-F]` не видит форму с фолбэком
 * (`var(--c-rose, #fff)18`), которая сломана ровно так же.
 *
 * Не экспортируется намеренно: гейт проверяется как чёрный ящик — реальный
 * скрипт в песочнице, как его зовёт CI (gate-sandbox.ts), а не его потроха.
 */
function findGluedHexSuffix(text, isCss) {
  const hits = [];
  stripComments(text, isCss)
    .split('\n')
    .forEach((line, i) => {
      let at = 0;
      while ((at = line.indexOf('var(--', at)) !== -1) {
        const open = at + 3;
        let depth = 0;
        let close = -1;
        for (let j = open; j < line.length; j++) {
          if (line[j] === '(') depth++;
          else if (line[j] === ')' && --depth === 0) {
            close = j;
            break;
          }
        }
        if (close === -1) break; // var() не закрыт на этой строке
        const suffix = line.slice(close + 1).match(/^[0-9a-fA-F]+/);
        if (suffix) {
          hits.push({
            ln: i + 1,
            hit: line.slice(at, close + 1 + suffix[0].length),
            line: line.trim().slice(0, 100),
          });
        }
        at = close + 1;
      }
    });
  return hits;
}

function main() {
  const found = [];
  for (const file of SCAN_DIRS.flatMap((d) => walk(d))) {
    let src;
    try {
      src = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    for (const h of findGluedHexSuffix(src, file.endsWith('.css'))) {
      found.push({ file, ...h });
    }
  }

  if (found.length) {
    console.error(
      `❌ Hex-суффикс альфы к var(): ${found.length} невалидных значений.\n`,
    );
    for (const h of found) {
      console.error(`  ${h.file}:${h.ln} «${h.hit}»`);
      console.error(`    ${h.line}`);
    }
    console.error(
      '\nvar() подставляется ПОСЛЕ парсинга, поэтому значение невалидно «на\n' +
        'этапе вычисления»: браузер берёт НАЧАЛЬНОЕ значение свойства, молча.\n' +
        'Исходы разные и все плохие (замерено в Chromium, PR #520):\n' +
        '  background: var(--c-amber)08      → фона нет совсем, включая тот,\n' +
        '    что задан классом ниже в каскаде;\n' +
        '  border-color: var(--c-moss)40     → две стороны в полную силу,\n' +
        '    две — тёмно-синим;\n' +
        '  border: 1px solid var(--c-moss)33 → шорткат мёртв целиком.\n\n' +
        'Прозрачную версию токена берут через color-mix:\n' +
        "  background: 'color-mix(in srgb, var(--c-rose) 9%, transparent)'\n" +
        'Проценты из hex — hex/255: 08→3%, 10→6%, 18→9%, 33→20%, 40→25%.',
    );
    process.exit(1);
  }

  console.log('✓ hex-суффикс альфы к var(): ни одного');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
