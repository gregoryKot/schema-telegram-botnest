// Разбор контроллеров для check-persistent-throttle.mjs — вынесено из движка
// (правило №10 CLAUDE.md: гейт дробится на движок + модуль разбора, а не
// получает исключение из храповика размера).
//
// Разбирает `src/**/*.controller.ts` настоящим проходом по телу класса, а не
// регэкспом по строкам: декораторы хендлера лежат и до, и после `@Post(...)`,
// у метода бывает `Promise<{ ok: true }>` с фигурными скобками в типе, а
// комментарий с упоминанием `@Throttle(` не должен считаться декоратором.

const HTTP = /^(?:Get|Post|Patch|Put|Delete)$/;
// Декораторы, после которых счётчик ручки живёт в Postgres (правило №5):
// `AdminThrottle` ставят на КЛАСС, `PersistentThrottleLimit` = Throttle + метка.
const MARKERS = new Set(['PersistentThrottle', 'PersistentThrottleLimit', 'AdminThrottle']);
const THROTTLES = new Set(['Throttle', 'PersistentThrottleLimit']);
// Тело хендлера, которое проверяет код или создаёт заявку, нуждается в
// классификации, даже если `@Throttle(` забыли поставить вовсе.
const TRIGGERS = new RegExp(
  [
    '\\bverifyCode\\(', // проверка TOTP-кода (challenge)
    '\\bassertSourceTotp\\(', // TOTP исходного аккаунта (merge)
    '\\bconfirmSetup\\(', // подтверждение настройки 2FA кодом (2fa/enable)
    '\\bregenerateRecoveryCodes\\(', // код TOTP за новые резервные коды
    '\\btotp\\.disable\\(', // код TOTP за отключение 2FA (2fa/disable)
    '\\bconsumeEmailToken\\(', // погашение токена из письма (перебираемая строка)
    '\\.approve\\(',
    '\\bapproveLogin',
    '\\.deny\\(',
    '\\.submit\\(',
  ].join('|'),
);

/** Убирает комментарии, сохраняя переводы строк и строковые литералы. */
export function stripComments(text) {
  let out = '';
  for (let i = 0, quote = null; i < text.length; ) {
    const c = text[i];
    const two = text.substr(i, 2);
    if (quote) {
      out += c;
      if (c === '\\') { out += text[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c; out += c; i += 1;
    } else if (two === '//') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += c; i += 1;
    }
  }
  return out;
}

const PAIRS = { '(': ')', '[': ']', '{': '}' };

/** Индекс закрывающей скобки, парной открывающей на `open` (строки пропускаются). */
function closeOf(src, open) {
  const stack = [];
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i += 1; i < src.length && src[i] !== c; i += 1) if (src[i] === '\\') i += 1;
    } else if (PAIRS[c]) stack.push(PAIRS[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return src.length;
}

const skipWs = (src, i) => i + (src.slice(i).match(/^\s*/)?.[0].length ?? 0);

/** Конец оператора верхнего уровня: `;` либо закрытие верхнеуровневого блока. */
function statementEnd(src, from) {
  for (let i = from; i < src.length; i += 1) {
    const c = src[i];
    if (c === ';') return i + 1;
    if (PAIRS[c]) {
      i = closeOf(src, i);
      if (c === '{') return i + 1;
    }
  }
  return src.length;
}

function readDecorator(src, at) {
  const name = src.slice(at + 1).match(/^[\w$.]+/)?.[0] ?? '';
  let end = at + 1 + name.length;
  const open = skipWs(src, end);
  let args = '';
  if (src[open] === '(') {
    end = closeOf(src, open) + 1;
    args = src.slice(open + 1, end - 1);
  }
  return { name, args, end };
}

const firstString = (args) => args.match(/['"`]([^'"`]*)['"`]/)?.[1] ?? '';

/** Позиция `{` тела метода после `)`; тип возврата `{ … }` пропускается. */
function bodyOpen(src, from) {
  let angle = 0;
  for (let i = skipWs(src, from); i < src.length; i += 1) {
    const c = src[i];
    if (c === ';') return -1;
    if (c === '<') angle += 1;
    else if (c === '>' && src[i - 1] !== '=') angle -= 1;
    else if (c === '(' || c === '[') i = closeOf(src, i);
    else if (c === '{') {
      const prev = src.slice(0, i).trimEnd().slice(-1);
      if (angle > 0 || ':|&,'.includes(prev)) i = closeOf(src, i);
      else return i;
    }
  }
  return -1;
}

function parseMember(src, at) {
  const head = src.slice(at).match(/^(?:(?:public|private|protected|static|readonly|async|abstract|override)\s+)*([A-Za-z_$][\w$]*)/);
  const afterName = skipWs(src, at + (head?.[0].length ?? 0));
  if (!head || src[afterName] !== '(') return { end: statementEnd(src, at) };
  const params = closeOf(src, afterName);
  const open = bodyOpen(src, params + 1);
  if (open === -1) return { end: statementEnd(src, params + 1) };
  const close = closeOf(src, open);
  return { end: close + 1, body: src.slice(open, close + 1) };
}

const routeKey = (method, prefix, sub) =>
  `${method} /${[prefix, sub].join('/').split('/').filter(Boolean).join('/').replace(/:[A-Za-z0-9_]+/g, ':param')}`;

function parseClass(src, open, classDecs, handlers) {
  const close = closeOf(src, open);
  const ctrl = classDecs.find((d) => d.name === 'Controller');
  const prefix = ctrl ? firstString(ctrl.args) : '';
  const classMarked = classDecs.some((d) => MARKERS.has(d.name));
  const classThrottled = classDecs.some((d) => THROTTLES.has(d.name));
  let decs = [];
  for (let i = skipWs(src, open + 1); i < close; i = skipWs(src, i)) {
    if (src[i] === '@') {
      const d = readDecorator(src, i);
      decs.push(d);
      i = d.end;
      continue;
    }
    const m = parseMember(src, i);
    const http = decs.find((d) => HTTP.test(d.name));
    if (http) {
      const names = decs.map((d) => d.name);
      handlers.push({
        key: routeKey(http.name.toUpperCase(), prefix, firstString(http.args)),
        line: src.slice(0, i).split('\n').length,
        marked: classMarked || names.some((n) => MARKERS.has(n)),
        throttled: classThrottled || names.some((n) => THROTTLES.has(n)),
        triggers: TRIGGERS.test(m.body ?? ''),
      });
    }
    decs = [];
    i = m.end;
  }
  return close + 1;
}

/** Хендлеры файла + число HTTP-декораторов (сверка: ничего не потеряли). */
export function parseControllerFile(raw) {
  const src = stripComments(raw);
  const handlers = [];
  let decs = [];
  for (let i = skipWs(src, 0); i < src.length; i = skipWs(src, i)) {
    if (src[i] === '@') {
      const d = readDecorator(src, i);
      decs.push(d);
      i = d.end;
      continue;
    }
    const cls = src.slice(i).match(/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+[^{]*\{/);
    if (cls) i = parseClass(src, i + cls[0].length - 1, decs, handlers);
    else i = statementEnd(src, i);
    decs = [];
  }
  const expected = (src.match(/@(?:Get|Post|Patch|Put|Delete)\(/g) ?? []).length;
  return { handlers, expected };
}
