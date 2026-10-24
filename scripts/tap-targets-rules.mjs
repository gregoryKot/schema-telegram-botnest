#!/usr/bin/env node
// Правила гейта тап-целей — вынесены из check-tap-targets.mjs, чтобы движок
// (обход дерева, храповик, отчёт) не рос вместе с разбором JSX (правило №10:
// файл дробится, а не пухнет; образец — silent-catch-rules.mjs). Границы
// того, что считается и что нет, держит tap-targets.spec.ts.
//
// Единица учёта — ОТКРЫВАЮЩИЙ JSX-тег. Он считается, когда одновременно:
//   (а) интерактивен: `<button`, либо атрибут onClick, либо role="button" /
//       "checkbox" / "slider";
//   (б) в его инлайн-`style={{…}}` ЧИСЛАМИ заданы и ширина, и высота
//       (width/minWidth и height/minHeight), и ОБА эффективных размера < 44;
//   (в) в теге не упомянут hitboxStyle (shared/src/utils/hitbox.ts).
//
// Разбор — посимвольный, с учётом вложенных `{}` (style — это объект):
// конец тега — первый `>` на нулевой глубине скобок. Смотрим только
// ВЕРХНИЙ уровень style-объекта: `...(x ? { width: 20 } : {})` решением не
// является, а гейт, угадывающий ветку, краснел бы на законном.

export const MIN_TARGET_PX = 44;

const INTERACTIVE_ROLE_RE = /['"](?:button|checkbox|slider)['"]/;
// Значение целиком — число (`30`, `30.5`) либо строка с ним (`'30px'`,
// `"30"`). Переменная, `var(--x)`, `100%`, шаблон и `30 + gap` не матчатся.
const NUMBER_RE = /^(?:(\d+(?:\.\d+)?)|(['"])(\d+(?:\.\d+)?)(?:px)?\2)$/;
const SIZE_KEY_RE = /^(width|minWidth|height|minHeight)\s*:\s*([\s\S]+)$/;
const NAME_RE = /[A-Za-z_:][\w:.-]*/y;

// Закрывающая скобка парной `{`/`(`/`[`, начиная с open; строки пропускаются.
function closeOf(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '{' || c === '(' || c === '[') depth++;
    else if ((c === '}' || c === ')' || c === ']') && --depth === 0) return i;
  }
  return -1;
}

// Разбор открывающего тега с `<` в позиции start. null — это не JSX-тег.
function parseTag(src, start) {
  NAME_RE.lastIndex = start + 1;
  const nm = NAME_RE.exec(src);
  if (!nm) return null;
  const attrs = [];
  let i = start + 1 + nm[0].length;
  let pending = null;
  while (i < src.length && i - start < 4000) {
    const c = src[i];
    if (c === '>') return { name: nm[0], attrs, end: i };
    if (c === ';') return null; // `;` вне скобок — не JSX
    if (c === '{') {
      const close = closeOf(src, i);
      if (close < 0) return null;
      attrs.push([pending ?? '...', src.slice(i + 1, close)]);
      pending = null;
      i = close + 1;
    } else if (c === '"' || c === "'") {
      const close = src.indexOf(c, i + 1);
      if (close < 0) return null;
      attrs.push([pending ?? '', src.slice(i, close + 1)]);
      pending = null;
      i = close + 1;
    } else if (c === '=') {
      i++;
    } else {
      NAME_RE.lastIndex = i;
      const a = NAME_RE.exec(src);
      if (a) {
        if (src[i + a[0].length] === '=') pending = a[0];
        else attrs.push([a[0], null]);
        i += a[0].length;
      } else i++;
    }
  }
  return null;
}

// Свойства верхнего уровня объектного литерала `{ … }` (внутренность без скобок).
function topLevelProps(obj) {
  const props = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i <= obj.length; i++) {
    const c = obj[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < obj.length && obj[i] !== c; i++) if (obj[i] === '\\') i++;
    } else if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if ((c === ',' || i === obj.length) && depth === 0) {
      props.push(obj.slice(from, i).trim());
      from = i + 1;
    }
  }
  return props;
}

// Эффективные { w, h } из числовых литералов style; null — пары нет.
// minWidth поднимает планку width, поэтому берётся максимум по оси.
function numericSize(styleExpr) {
  const t = styleExpr.trim();
  if (!t.startsWith('{') || closeOf(t, 0) !== t.length - 1) return null;
  const size = { w: null, h: null };
  for (const prop of topLevelProps(t.slice(1, -1))) {
    const m = SIZE_KEY_RE.exec(prop);
    const v = m && NUMBER_RE.exec(m[2].trim());
    if (!v) continue;
    const axis = m[1].endsWith('idth') ? 'w' : 'h';
    const px = parseFloat(v[1] ?? v[3]);
    size[axis] = size[axis] === null ? px : Math.max(size[axis], px);
  }
  return size.w === null || size.h === null ? null : size;
}

const isInteractive = (tag) =>
  tag.name === 'button' ||
  tag.attrs.some(
    ([n, v]) => n === 'onClick' || (n === 'role' && INTERACTIVE_ROLE_RE.test(v ?? '')),
  );

// Все подпороговые тап-цели файла (src уже без комментариев): [{ line, tag, w, h }].
export function findTapTargets(src) {
  const hits = [];
  let line = 1;
  let counted = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<' || /[\w$)\].]/.test(src[i - 1] ?? ' ')) continue;
    const tag = parseTag(src, i);
    if (!tag) continue;
    const style = tag.attrs.find(([n]) => n === 'style')?.[1];
    if (style == null || !isInteractive(tag)) continue;
    if (src.slice(i, tag.end).includes('hitboxStyle')) continue;
    const size = numericSize(style);
    if (!size || size.w >= MIN_TARGET_PX || size.h >= MIN_TARGET_PX) continue;
    for (; counted < i; counted++) if (src[counted] === '\n') line++;
    hits.push({ line, tag: tag.name, w: size.w, h: size.h });
  }
  return hits;
}
