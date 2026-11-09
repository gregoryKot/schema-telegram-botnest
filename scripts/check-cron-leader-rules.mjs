// Разбор исходника для гейта check-cron-leader.mjs (движок — там же: обход
// дерева, бейслайн, отчёт). Вынесено, когда гейту понадобился транзитивный
// разбор вызовов внутри класса, а он уже стоял на 258 строках из 300 (№10).
//
// Транзитивность нужна в обе стороны:
//   - leader-крон, чей `claimRun(` живёт в методе-обёртке (`this.runLeased()`),
//     законен — аренда взята, просто не в теле метода под `@Cron`;
//   - метод, до которого через `this.x()` доходят ДВА leader-крона, исполняется
//     под двумя разными арендами: каждая страхует от второго инстанса только
//     свой тик, а побочный эффект общего метода идёт дважды (находка «досылка в
//     канал запускалась двумя кронами», `tickCatchUp`). Законный общий хелпер
//     (`alert()` у обоих `tick*`, `maybePost` у утра и вечера с непересекающимися
//     расписаниями) классифицируется в бейслайне `status: "shared"` с причиной.
// Разбор — по одному файлу: `this.x()` ищется среди методов того же файла.
// Слепая зона: стрелочные свойства класса (`private x = () => {}`) и вызовы
// через переменную (`const f = this.x; f()`) не видны.
import { matchBrace, matchParen, lineAt } from './gate-balance.mjs';

// Слова-отписки, недопустимые в причине (правило №15: исключение без разбора
// — то же замалчивание, что и обход гейта).
export const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'constructor', 'super', 'await', 'typeof', 'new']);

export function stripComments(src) {
  // Комментарии заменяются пробелами с сохранением переводов строк: номера
  // строк в отчёте верны, упоминание `@Cron(`/`claimRun(` в комментарии — не код.
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Имя метода и позиция его `(` — первая сигнатура после pos, пропуская
 * пробелы, соседние декораторы и модификаторы (async/public/…). */
export function findMethodAfter(src, pos) {
  let i = pos;
  const n = src.length;
  for (;;) {
    while (i < n && /\s/.test(src[i])) i += 1;
    if (src[i] !== '@') break;
    i += 1;
    while (i < n && /[\w$.]/.test(src[i])) i += 1;
    while (i < n && /\s/.test(src[i])) i += 1;
    if (src[i] === '(') {
      const close = matchParen(src, i);
      if (close === -1) return null;
      i = close + 1;
    }
  }
  const modRe = /^(?:public|private|protected|static|readonly|async|override)\s+/;
  for (let m = src.slice(i).match(modRe); m; m = src.slice(i).match(modRe)) i += m[0].length;
  const nameMatch = src.slice(i).match(/^([A-Za-z_$][\w$]*)\s*\(/);
  if (!nameMatch) return null;
  return { name: nameMatch[1], parenOpen: i + nameMatch[0].length - 1 };
}

/** Тело метода по позиции `(` параметров: от `{` после сигнатуры (тип
 * возврата пропускается) до парной `}`; null — это не объявление. */
function bodyAfterParams(src, parenOpen) {
  const paramsClose = matchParen(src, parenOpen);
  if (paramsClose === -1) return null;
  const rest = src.slice(paramsClose + 1);
  const m = /^\s*(?::[^{;=]*?)?\{/.exec(rest);
  if (!m) return null;
  const open = paramsClose + 1 + m[0].length - 1;
  const close = matchBrace(src, open);
  return close === -1 ? null : src.slice(open, close + 1);
}

/** Методы класса(ов) файла: имя → тело. */
export function findMethods(src) {
  const methods = new Map();
  const re = /^[ \t]+(?:(?:public|private|protected|static|readonly|async|override)\s+)*([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(src))) {
    if (KEYWORDS.has(m[1]) || methods.has(m[1])) continue;
    const body = bodyAfterParams(src, m.index + m[0].length - 1);
    if (body) methods.set(m[1], body);
  }
  return methods;
}

/** Методы, до которых тело доходит через `this.x()` (транзитивно). */
export function reach(methods, body) {
  const seen = new Set();
  const queue = [body];
  while (queue.length) {
    for (const c of queue.pop().matchAll(/\bthis\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (seen.has(c[1]) || !methods.has(c[1])) continue;
      seen.add(c[1]);
      queue.push(methods.get(c[1]));
    }
  }
  return seen;
}

/** Все `@Cron(` файла: [{ key, method, line, hasClaimRun, covers }], где
 * covers — сам метод и всё, до чего он доходит. */
export function findCrons(relPath, rawSrc) {
  const src = stripComments(rawSrc);
  const methods = findMethods(src);
  const found = [];
  const re = /@Cron\(/g;
  let m;
  while ((m = re.exec(src))) {
    const decoratorClose = matchParen(src, m.index + m[0].length - 1);
    if (decoratorClose === -1) continue;
    const method = findMethodAfter(src, decoratorClose + 1);
    const body = method && bodyAfterParams(src, method.parenOpen);
    if (!body) continue;
    const reached = reach(methods, body);
    const bodies = [body, ...[...reached].map((n) => methods.get(n))];
    found.push({
      key: `${relPath}::${method.name}`,
      method: method.name,
      line: lineAt(src, m.index),
      hasClaimRun: bodies.some((b) => /claimRun\(/.test(b)),
      covers: new Set([method.name, ...reached]),
    });
  }
  return found;
}

export function reasonProblem(key, reason, status) {
  const r = String(reason ?? '').trim();
  if (r.length < 20) return `${key}: ${status} без внятной причины (короче 20 символов)`;
  const flag = REASON_RED_FLAGS.find((w) => r.toLowerCase().includes(w));
  return flag ? `${key}: ${status}-причина похожа на отписку (слово «${flag}»)` : null;
}

/** Методы, до которых доходят два и больше leader-крона одного файла:
 * Map<«файл::метод», [крон, …]>. */
export function sharedUnderLeases(crons, baseline) {
  const byMethod = new Map();
  for (const c of crons) {
    if (baseline[c.key]?.status !== 'leader') continue;
    const file = c.key.split('::')[0];
    for (const name of c.covers) {
      const k = `${file}::${name}`;
      byMethod.set(k, [...(byMethod.get(k) ?? []), c.method]);
    }
  }
  return new Map([...byMethod].filter(([, owners]) => owners.length > 1));
}
