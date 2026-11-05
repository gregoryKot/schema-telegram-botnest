#!/usr/bin/env node
// Под-лист с z-index ниже родителя (инцидент 2026-11-05, экран паттерна).
//
// `PatternSheet` стоял на `zIndex={205}`, а опросник, который он открывает
// по «Дополнить» (`.ex2-screen`, z-index 200), и «О схеме» (`SsSheet` без
// zIndex, 200) рисовались ПОД ним: кнопка «не работает», в DOM всё на месте,
// ошибки нет. Тест мокал опросник и проверял только, что он появился в
// DOM — к стеку слеп.
//
// Правило: полноэкранные листы одного уровня стыкуются ПОРЯДКОМ В DOM —
// сиблинг, отрисованный позже, при равном z-index лежит выше. Число нужно
// только чтобы встать выше чужого ПОЗДНЕГО сиблинга. Под-лист, открытый из
// листа, стоит на z-index не ниже родителя.
//
// Как считается (без бейслайна, класс вычищен целиком — правило №15):
// - карта CSS-классов оверлеев: правило с `position: fixed` и `z-index: N`
//   в webapp/src/index.css и webapp/src/styles/*.css → `.класс` → N;
// - ownZ(файл) — z-index корневого оверлея файла: дефолт пропа `zIndex = N`
//   в сигнатуре, иначе первый по порядку НЕсамозакрывающийся JSX-тег (оболочка
//   с детьми, не ребёнок), у которого есть `zIndex={N}`, className с классом
//   из карты или который сам — импортированный относительным путём компонент
//   с ownZ ≠ null (рекурсивно; `lazy(() => import('./x'))` — тоже импорт).
//   Нет → null;
// - в файле с ownZ = R каждый тег импортированного компонента-оверлея даёт
//   childZ = явный `zIndex={N}` на теге, иначе ownZ компонента;
//   childZ < R — нарушение.
import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import {
  cssOverlayMap,
  defaultPropZ,
  jsxTags,
  relativeImports,
  walkTsx,
} from './overlay-stack-scan.mjs';

const ROOT = join(import.meta.dirname, '..');
const WEBAPP_SRC = join(ROOT, 'webapp/src');

function cssFiles() {
  const files = [join(WEBAPP_SRC, 'index.css')];
  try {
    for (const n of readdirSync(join(WEBAPP_SRC, 'styles'))) {
      if (n.endsWith('.css')) files.push(join(WEBAPP_SRC, 'styles', n));
    }
  } catch {
    /* каталога стилей может не быть (песочница теста) */
  }
  return files.filter((f) => {
    try {
      readFileSync(f);
      return true;
    } catch {
      return false;
    }
  });
}

const cssMap = cssOverlayMap(cssFiles());
const parsed = new Map();
const ownZCache = new Map();
const inProgress = new Set();

function parse(file) {
  if (!parsed.has(file)) {
    let src = '';
    try {
      src = stripComments(readFileSync(file, 'utf8'), false);
    } catch {
      /* нет файла — нет тегов */
    }
    parsed.set(file, {
      imports: relativeImports(file, src),
      tags: jsxTags(src, cssMap),
      defaultZ: defaultPropZ(src),
    });
  }
  return parsed.get(file);
}

function ownZ(file) {
  if (ownZCache.has(file)) return ownZCache.get(file);
  if (inProgress.has(file)) return null; // цикл импортов — не оверлей
  inProgress.add(file);
  let z = null;
  if (file.endsWith('.tsx')) {
    const { imports, tags, defaultZ } = parse(file);
    z = defaultZ;
    for (const t of tags) {
      if (z !== null) break;
      // Самозакрывающийся тег — ребёнок, которого файл просто рисует, а не
      // его оболочка: App.tsx с <OfflineBanner /> оверлеем не становится.
      if (t.selfClosing) continue;
      const v = tagZ(t, imports);
      if (v !== null) {
        z = v;
        break;
      }
    }
  }
  inProgress.delete(file);
  ownZCache.set(file, z);
  return z;
}

/** z-index тега: явный проп, класс из карты, иначе ownZ импортированного компонента. */
function tagZ(t, imports) {
  if (t.explicitZ !== null) return t.explicitZ;
  if (t.classZ !== null) return t.classZ;
  const target = imports.get(t.name);
  return target ? ownZ(target) : null;
}

function violations(file) {
  const found = [];
  const root = ownZ(file);
  if (root === null) return found;
  const { imports, tags } = parse(file);
  for (const t of tags) {
    const target = imports.get(t.name);
    if (!target || t.zPassedThrough) continue;
    const childZ = t.explicitZ ?? ownZ(target);
    if (childZ !== null && childZ < root)
      found.push({ line: t.line, name: t.name, childZ, root });
  }
  return found;
}

function main() {
  const found = [];
  const verbose = process.argv.includes('--verbose');
  for (const file of walkTsx(WEBAPP_SRC)) {
    if (verbose && ownZ(file) !== null)
      console.log(`${relative(ROOT, file)}: z=${ownZ(file)}`);
    for (const v of violations(file))
      found.push({ file: relative(ROOT, file), ...v });
  }
  if (found.length) {
    console.error(`❌ Под-лист с z-index ниже родителя: ${found.length}.\n`);
    for (const v of found) {
      console.error(
        `  ${v.file}:${v.line}: <${v.name}> z=${v.childZ} под родителем z=${v.root}`,
      );
    }
    console.error(
      '\nЛист, открытый из листа, рисуется ПОД ним: кнопка «не работает», в DOM всё\n' +
        'на месте. Листы одного уровня стыкуются порядком в DOM — сиблинг,\n' +
        'отрисованный позже, при равном z-index лежит выше. Убери лишний zIndex у\n' +
        'родителя или подними у ребёнка (не ниже родителя).',
    );
    process.exit(1);
  }
  console.log('✓ стек оверлеев: под-листов ниже родителя нет');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
