// Текстовый слой гейта check-local-cache-writers.mjs: скобки, строки,
// аргументы, инициализаторы констант и объектов, return функции-строителя.
// Отделён от local-cache-resolve.mjs (разрешение ключа по импортам и
// константам), чтобы ни один из модулей не стоял у потолка размера файла
// (правило №10: гейт у потолка дробится на движок и модуль правил).
// Сканер простой, но не наивный: содержимое строк и шаблонных литералов не
// считается источником скобок и запятых.

/** Индекс символа после строкового/шаблонного литерала, начавшегося в i. */
export function skipString(src, i) {
  const quote = src[i];
  i += 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i += 1;
  }
  return i;
}

/** Индекс закрывающей скобки, парной открывающей на openIndex ((, [ или {). */
export function matchBracket(src, openIndex) {
  const open = src[openIndex];
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Разбивает текст на части по разделителю верхнего уровня (запятая, `+`, `?`). */
export function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(text, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (depth === 0 && c === sep) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

/** Текст инициализатора после `=`: до `;` верхнего уровня. */
export function readInitializer(src, from) {
  let depth = 0;
  for (let i = from; i < src.length && i - from < 4000; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ';' && depth === 0) return src.slice(from, i);
  }
  return src.slice(from, from + 4000);
}

/** Первое `return <expr>;` в теле функции (между фигурными скобками). */
export function returnExpr(body) {
  const m = /\breturn\s+/.exec(body);
  if (!m) return null;
  return readInitializer(body, m.index + m[0].length).trim();
}

/** Выражение-значение функции с именем name в файле: return или тело стрелки. */
export function functionValueExpr(src, name) {
  const decl = new RegExp(`(?:^|[^\\w$.])function\\s+${name}\\s*(?:<[^(]*>)?\\s*\\(`, 'm').exec(src);
  if (decl) {
    const paren = decl.index + decl[0].length - 1;
    const close = matchBracket(src, paren);
    const brace = close === -1 ? -1 : src.indexOf('{', close);
    if (brace === -1) return null;
    const end = matchBracket(src, brace);
    return end === -1 ? null : returnExpr(src.slice(brace + 1, end));
  }
  const init = constInitializer(src, name);
  if (init === null) return null;
  const arrow = init.indexOf('=>');
  if (arrow === -1) return null;
  const body = init.slice(arrow + 2).trim();
  if (body.startsWith('{')) {
    const end = matchBracket(body, 0);
    return end === -1 ? null : returnExpr(body.slice(1, end));
  }
  return body;
}

/** Инициализатор `const NAME = …` (с опциональной аннотацией типа) или null. */
export function constInitializer(src, name) {
  const re = new RegExp(
    `(?:^|[^\\w$.])(?:export\\s+)?(?:const|let)\\s+${name}\\b\\s*(?::\\s*[^=;]+?)?\\s*=(?!=)\\s*`,
    'm',
  );
  const m = re.exec(src);
  return m ? readInitializer(src, m.index + m[0].length) : null;
}

/** Строка после `as …`/`satisfies …` и внешних скобок убирается. */
export function unwrap(expr) {
  let e = expr.trim();
  for (;;) {
    const next = e.replace(/\s+(?:as|satisfies)\s+[\w<>[\]|'" ,]+$/, '').trim();
    if (next !== e) { e = next; continue; }
    if (e.startsWith('(') && matchBracket(e, 0) === e.length - 1) { e = e.slice(1, -1).trim(); continue; }
    return e;
  }
}

/** Пары `имя: выражение` объектного литерала `{ … }`. */
export function objectEntries(literal) {
  const inner = literal.slice(1, matchBracket(literal, 0));
  return splitTopLevel(inner, ',')
    .filter(Boolean)
    .map((entry) => {
      const colon = entry.search(/:(?!:)/);
      if (colon === -1) return { name: entry.trim(), expr: entry.trim() };
      return { name: entry.slice(0, colon).trim().replace(/^['"]|['"]$/g, ''), expr: entry.slice(colon + 1).trim() };
    });
}
