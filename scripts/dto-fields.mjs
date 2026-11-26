// Разбор DTO-классов class-validator для гейтов scripts/check-dto-*.mjs.
// Не полноценный TypeScript-парсер: класс -> члены -> декораторы с аргументами
// (скобки считаются с учётом строк и экранирования). Этого хватает, чтобы
// ответить на вопрос «какие декораторы стоят на поле X класса Y».
//
// Вход — текст файла БЕЗ комментариев (scripts/gate-strip-comments.mjs):
// декоратор, закомментированный или упомянутый в пояснении, не засчитывается.

/** Закрывающая скобка парной открывающей на позиции `open`; -1 если не нашлась. */
function matchBracket(text, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [];
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '\\') i++;
    else if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

const FIELD_HEAD =
  /^\s*(?:(?:public|private|protected|readonly|declare)\s+)*([A-Za-z_$][\w$]*)\s*[?!]?\s*:/;

/** Конец члена класса, начинающегося в `from`: после `;` (поле) или после тела метода. */
function memberEnd(body, from) {
  const isField = FIELD_HEAD.test(body.slice(from, from + 200));
  let i = from;
  while (i < body.length) {
    const c = body[i];
    if (c === '(' || c === '{' || c === '[') {
      const close = matchBracket(body, i);
      if (close < 0) return body.length;
      i = close + 1;
      if (!isField && c === '{') return i;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const close = body.indexOf(c, i + 1);
      i = close < 0 ? body.length : close + 1;
      continue;
    }
    if (c === ';') return i + 1;
    i++;
  }
  return body.length;
}

/** Члены тела класса: { name|null, decorators: [{ name, args }] }. */
function parseMembers(body) {
  const members = [];
  let i = 0;
  let decorators = [];
  while (i < body.length) {
    if (/\s/.test(body[i])) {
      i++;
      continue;
    }
    if (body[i] === '@') {
      const m = /^@([\w.$]+)/.exec(body.slice(i));
      i += m[0].length;
      let args = '';
      if (body[i] === '(') {
        const close = matchBracket(body, i);
        args = body.slice(i + 1, close < 0 ? body.length : close);
        i = close < 0 ? body.length : close + 1;
      }
      // `v.IsString` (import * as v) — тот же декоратор, что и `IsString`.
      decorators.push({ name: m[1].split('.').pop(), args });
      continue;
    }
    const end = memberEnd(body, i);
    const head = FIELD_HEAD.exec(body.slice(i, end));
    members.push({ name: head ? head[1] : null, decorators });
    decorators = [];
    i = end;
  }
  return members;
}

/** Все классы файла: [{ name, members }]. */
export function parseClasses(text) {
  const out = [];
  const re = /\bclass\s+([A-Za-z_$][\w$]*)[^{;]*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const open = m.index + m[0].length - 1;
    const close = matchBracket(text, open);
    if (close < 0) break;
    out.push({
      name: m[1],
      members: parseMembers(text.slice(open + 1, close)),
    });
    re.lastIndex = close + 1;
  }
  return out;
}
