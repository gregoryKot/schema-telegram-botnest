#!/usr/bin/env node
// Элемент, спрятанный через opacity: 0 и раскрываемый ТОЛЬКО по :hover.
//
// На телефоне hover нет: тап по строке не делает :hover «навсегда», а
// кнопка, которую раскрывает только он, для пальца не существует. Находка
// аудита 2026-10: `.evi-x { opacity: 0 }` + `.evi-row:hover .evi-x
// { opacity: 1 }` — кнопка удаления доказательства в «Проверке убеждения».
// Строка выглядела неудаляемой, а с клавиатуры кнопка оставалась
// фокусируемой: Tab уходил в пустое место (WCAG 2.4.7).
//
// Правило: если у элемента есть правило сокрытия (`opacity: 0` или
// `visibility: hidden`) и его раскрывает :hover, то путей без hover нужно
// два: для пальца (`@media (hover: none)` / `(pointer: coarse)`) и для
// клавиатуры (`:focus-within` / `:focus-visible`); класс состояния
// (`.selected`, `.ready`) закрывает оба. Сокрытие внутри `@media (hover:
// hover)` / `(pointer: fine)` на телефоне не действует — путь для пальца ему
// не нужен. Раскрытие без :hover вовсе (ссылка «к содержимому» по :focus) —
// не этот класс. Правила внутри @keyframes не считаются.
//
// Гейт АБСОЛЮТНЫЙ, без бейслайна и без списка исключений: класс вычищен в
// том же PR, замораживать нечему (правило №15 CLAUDE.md). Образец по
// устройству — check-var-alpha-suffix.mjs.
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { parseCssRules, splitSelectorList } from './css-rules-parse.mjs';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

const cssFiles = (dir) =>
  readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .filter((e) => !(e.parentPath ?? e.path).includes('node_modules'))
    .map((e) => join(e.parentPath ?? e.path, e.name).slice(ROOT.length + 1));

// Последний составной селектор без псевдо-классов/элементов → набор простых
// селекторов (`.a`, `#b`, `[c]`, `tag`), по которому правила «про один и тот
// же элемент» сопоставляются.
function subject(selector) {
  const last = selector.split(/\s*[>+~]\s*|\s+/).pop() ?? '';
  const bare = last.replace(/::?[\w-]+(\([^)]*\))?/g, '');
  return new Set(bare.match(/\.[\w-]+|#[\w-]+|\[[^\]]*\]|^[\w-]+|\*/g) ?? []);
}
const covers = (outer, inner) =>
  inner.size > 0 && [...inner].every((t) => outer.has(t));

const isHidden = (d) =>
  /^0(\.0+)?$/.test(d.opacity ?? '-') || d.visibility === 'hidden';
const isShown = (d) =>
  (d.opacity !== undefined && !/^0(\.0+)?$/.test(d.opacity)) ||
  d.visibility === 'visible';

// Раскрытие бывает трёх видов. Для пальца и клавиатуры нужны РАЗНЫЕ пути:
// тап на iOS Safari кнопку не фокусирует, поэтому одного :focus-within
// телефону мало; а `@media (hover: none)` на десктопе не срабатывает, и
// фокус с клавиатуры без :focus-* уходит в невидимую кнопку.
//   - touch:  блок `(hover: none)` / `(pointer: coarse)`;
//   - focus:  `:focus-within` / `:focus-visible` / `:focus`;
//   - state:  всё остальное без :hover (класс `.selected`, `.ready`) — не
//             зависит от устройства ввода, закрывает оба пути сразу.
function kind(sel, ctx) {
  const media = ctx.join(' ');
  if (/\((hover:\s*none|pointer:\s*coarse|any-hover:\s*none)\)/.test(media))
    return 'touch';
  if (/:hover(?![\w-])/.test(sel) || /\(hover:\s*hover\)/.test(media))
    return 'hover';
  return /:focus(-within|-visible)?(?![\w-])/.test(sel) ? 'focus' : 'state';
}
const paths = (shown) => {
  const k = new Set(shown.map((r) => kind(r.sel, r.ctx)));
  return {
    touch: k.has('touch') || k.has('state'),
    keyboard: k.has('focus') || k.has('state'),
  };
};
// Сокрытие только на устройствах с мышью: на телефоне элемент и так виден.
// Запятая в @media — «или»: `(hover: hover), (max-width: 600px)` прячет и на
// телефоне; `not` переворачивает условие — оба случая не в счёт.
const mouseOnly = (ctx) => {
  const media = ctx.join(' ');
  return (
    !/,|\bnot\b/.test(media) &&
    /\((hover:\s*hover|pointer:\s*fine)\)/.test(media)
  );
};

export function findHoverOnly(css) {
  const rules = parseCssRules(stripComments(css, true)).flatMap((r) =>
    splitSelectorList(r.selector).map((sel) => ({ ...r, sel })),
  );
  const found = [];
  for (const h of rules.filter(
    (r) => isHidden(r.decls) && !r.sel.includes(':hover'),
  )) {
    const key = subject(h.sel);
    const shown = rules.filter(
      (r) => isShown(r.decls) && covers(subject(r.sel), key),
    );
    const p = paths(shown);
    if (mouseOnly(h.ctx)) p.touch = true;
    const viaHover = shown.some((r) => kind(r.sel, r.ctx) === 'hover');
    if (viaHover && !(p.touch && p.keyboard)) {
      found.push({ ln: h.line, sel: h.sel, shown, ...p });
    }
  }
  return found;
}

function main() {
  const found = [];
  for (const file of SCAN_DIRS.flatMap((d) => {
    try {
      return cssFiles(d);
    } catch {
      return [];
    }
  })) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    for (const f of findHoverOnly(src)) found.push({ file, ...f });
  }

  if (found.length) {
    console.error(
      `❌ Раскрытие только по :hover: ${found.length} элементов.\n`,
    );
    for (const f of found) {
      console.error(`  ${f.file}:${f.ln} «${f.sel}» спрятан, раскрывается:`);
      for (const r of f.shown)
        console.error(`    ${r.sel}  (строка ${r.line})`);
      if (!f.touch) console.error('    нет пути для пальца (hover: none)');
      if (!f.keyboard) console.error('    нет пути для клавиатуры (:focus-*)');
    }
    console.error(
      '\nНа телефоне hover нет, а с клавиатуры кнопка остаётся фокусируемой, но\n' +
        'невидимой. Нужны ОБА пути (тап на iOS кнопку не фокусирует):\n' +
        '  .row:focus-within .x, .x:focus-visible { opacity: 1 }\n' +
        '  @media (hover: none), (pointer: coarse) { .x { opacity: 1 } }\n' +
        'или раскрывай классом состояния (.selected, .ready) — он закрывает оба.',
    );
    process.exit(1);
  }
  console.log('✓ раскрытие только по :hover: ни одного');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
