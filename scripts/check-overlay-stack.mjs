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
// - карта CSS-классов оверлеев: правило с `position: fixed`, `inset: 0` и
//   `z-index: N` в shared/src/theme/*.css (`.u-sheet`, `.u-sheet-grid` — 80),
//   webapp/src/index.css и webapp/src/styles/*.css → `.класс` → N;
// - ownZ(файл) — z-index корневого оверлея файла: дефолт пропа `zIndex = N`
//   в сигнатуре, иначе первый по порядку НЕсамозакрывающийся JSX-тег (оболочка
//   с детьми, не ребёнок), у которого есть `zIndex={N}`, className с классом
//   из карты или который сам — компонент с z ≠ null: импортированный
//   относительным путём (`lazy(() => import('./x'))` — тоже) или объявленный
//   в том же файле. z компонента считают так же, но в его объявлении, а не по
//   всему файлу: `SSection` из файла с модалкой — не модалка. Нет → null;
// - в файле с ownZ = R каждый тег импортированного компонента-оверлея даёт
//   childZ = явный `zIndex={N}` на теге, иначе z компонента; свой тег
//   файла с классом из карты (обёртка `<div className="u-sheet">`) — z
//   класса: обёртка — свой контекст наложения, лист внутри неё не выше её z.
//   childZ < R — нарушение.
import { readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { cssOverlayMap, overlayCssFiles } from './overlay-stack-css.mjs';
import {
  defaultPropZ,
  jsxTags,
  relativeImports,
  topDecls,
  walkTsx,
} from './overlay-stack-scan.mjs';

const ROOT = join(import.meta.dirname, '..');
const WEBAPP_SRC = join(ROOT, 'webapp/src');

const cssMap = cssOverlayMap(overlayCssFiles(ROOT));
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
      src,
      decls: topDecls(src),
      imports: relativeImports(file, src),
      tags: jsxTags(src, cssMap),
    });
  }
  return parsed.get(file);
}

/** z компонента `name` из файла (null или не найден — весь файл). */
function ownZ(file, name = null) {
  const key = `${file}#${name}`;
  if (ownZCache.has(key)) return ownZCache.get(key);
  if (inProgress.has(key)) return null; // цикл импортов — не оверлей
  inProgress.add(key);
  let z = null;
  if (file.endsWith('.tsx')) {
    const p = parse(file);
    const d = name && p.decls.find((x) => x.name === name);
    const [from, to] = d ? [d.from, d.to] : [0, p.src.length];
    z = defaultPropZ(p.src.slice(from, to));
    for (const t of p.tags) {
      if (z !== null) break;
      if (t.index < from || t.index >= to) continue;
      // Самозакрывающийся тег — ребёнок, которого файл просто рисует (App.tsx с
      // <OfflineBanner /> оверлеем не становится); помощник из того же файла,
      // которого компонент возвращает (`return <PickerModal />`), — его разметка.
      if (t.selfClosing && !(d && isLocal(t, p))) continue;
      z = tagZ(t, file, p);
    }
  }
  inProgress.delete(key);
  ownZCache.set(key, z);
  return z;
}

// Компонент, объявленный в самом файле (`const X = lazy(…)` — импорт, не он).
const isLocal = (t, p) =>
  /^[A-Z]/.test(t.name) &&
  !p.imports.has(t.name) &&
  p.decls.some((x) => x.name === t.name);

/** z-index тега: явный проп, класс из карты, иначе z компонента — импортированного
 * или объявленного в том же файле. */
function tagZ(t, file, p) {
  if (t.explicitZ !== null) return t.explicitZ;
  if (t.classZ !== null) return t.classZ;
  const imp =
    p.imports.get(t.name) ?? (isLocal(t, p) ? { file, name: t.name } : null);
  return imp ? ownZ(imp.file, imp.name) : null;
}

function violations(file) {
  const found = [];
  const root = ownZ(file);
  if (root === null) return found;
  const { imports, tags } = parse(file);
  for (const t of tags) {
    if (t.zPassedThrough) continue;
    const imp = imports.get(t.name);
    // Импортированный под-лист — его z; свой тег файла — z класса из карты.
    const childZ = imp ? (t.explicitZ ?? ownZ(imp.file, imp.name)) : t.classZ;
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
