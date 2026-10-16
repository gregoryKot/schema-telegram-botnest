// Распознавание «оверлея» для гейта check-history-sheet.mjs: чистые функции
// над текстом, без файловой системы. Вынесено из движка гейта (правило №10:
// движок не растёт вместе со списком правил); тест — history-sheet.spec.ts.
import { stripComments } from './gate-strip-comments.mjs';

const FIXED_RE = /\bposition\s*:\s*['"]?fixed\b/g;
const INSET_ZERO_RE = /\binset\s*:\s*['"]?0(?:px)?\b/;
const SIDES_ZERO_RE = (side) => new RegExp(`\\b${side}\\s*:\\s*['"]?0(?:px)?\\b`);
const SIDES = ['top', 'left', 'right', 'bottom'];

/** Объявления покрывают весь экран: `inset: 0` либо все четыре стороны в нуле. */
export function coversViewport(decls) {
  return INSET_ZERO_RE.test(decls) || SIDES.every((s) => SIDES_ZERO_RE(s).test(decls));
}

/** Индекс символа после строкового литерала, начатого в i (кавычка в src[i]). */
function skipString(src, i) {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j += 1) {
    if (src[j] === '\\') j += 1;
    else if (src[j] === quote) return j;
  }
  return src.length - 1;
}

/** Индекс `}`, парной `{` в openIndex; -1, если не закрыта. */
function matchBrace(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') i = skipString(src, i);
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Индекс ближайшей незакрытой `{` слева от pos; -1, если её нет. */
function enclosingOpenBrace(src, pos) {
  let depth = 0;
  for (let i = pos - 1; i >= 0; i -= 1) {
    if (src[i] === '}') depth += 1;
    else if (src[i] === '{') {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
}

function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}

/**
 * Инлайновые оверлеи в .tsx: объект стиля (или CSS-в-строке), где одновременно
 * `position: fixed` и покрытие всего экрана. Пара обязана быть В ОДНОМ объекте:
 * `position: 'fixed'` у плавающей кнопки и `inset: 0` у соседнего блока —
 * не оверлей.
 */
export function inlineOverlays(rawSrc) {
  const src = stripComments(rawSrc, false);
  const found = [];
  for (const m of src.matchAll(FIXED_RE)) {
    const open = enclosingOpenBrace(src, m.index);
    if (open === -1) continue;
    const close = matchBrace(src, open);
    if (close === -1) continue;
    if (coversViewport(src.slice(open, close + 1))) {
      found.push({ line: lineAt(src, m.index), what: "position: fixed + inset: 0 (инлайн)" });
    }
  }
  return found;
}

/**
 * Классы, правило которых в CSS делает элемент оверлеем (fixed + весь экран).
 * Псевдоэлементы (`::before` — декор) и составные селекторы разбираются по
 * последнему классу последнего компонента селектора.
 */
export function overlayClasses(rawCss) {
  const css = stripComments(rawCss, true);
  const classes = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = m[2];
    FIXED_RE.lastIndex = 0;
    if (!FIXED_RE.test(decls) || !coversViewport(decls)) continue;
    for (const sel of m[1].split(',')) {
      if (/::|:before|:after/.test(sel)) continue;
      const last = sel.trim().split(/[\s>+~]+/).pop() ?? '';
      const tokens = [...last.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((t) => t[1]);
      if (tokens.length) classes.add(tokens[tokens.length - 1]);
    }
  }
  return classes;
}

/** Текст значений className=… / className: … в .tsx (строка или выражение в {}). */
function classNameValues(src) {
  const values = [];
  for (const m of src.matchAll(/\bclassName\s*[=:]\s*/g)) {
    const start = m.index + m[0].length;
    const c = src[start];
    if (c === '"' || c === "'" || c === '`') {
      values.push({ at: start, text: src.slice(start, skipString(src, start) + 1) });
    } else if (c === '{') {
      const close = matchBrace(src, start);
      if (close !== -1) values.push({ at: start, text: src.slice(start, close + 1) });
    }
  }
  return values;
}

/** Классы-оверлеи, реально проставленные файлу в className. */
export function classOverlays(rawSrc, overlayClassSet) {
  const src = stripComments(rawSrc, false);
  const found = [];
  for (const { at, text } of classNameValues(src)) {
    for (const cls of overlayClassSet) {
      if (new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(text)) {
        found.push({ line: lineAt(src, at), what: `класс «${cls}» (CSS: fixed + весь экран)` });
      }
    }
  }
  return found;
}

/** Вызывает ли файл хук (в коде, не в комментарии). */
export function callsHistorySheet(rawSrc) {
  return /\buseHistorySheet\s*\(/.test(stripComments(rawSrc, false));
}
