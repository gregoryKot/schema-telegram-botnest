// Правила гейта check-dead-end-report.mjs: что считать исходом-тупиком в коде экрана.
//   1. catch с исходом-ошибкой: сеттер с Error/Err/Fail в имени или с исходом-литералом.
//   2. catch без отчёта, где хоть один сеттер ставит пустое (`false`, `null`, `[]`, `''`)
//      или нейтральный статус из NEUTRAL_STATUSES — «пусто»/«ничего не было» вместо сбоя.
//   3. `.then(…set…)` без `.catch` в цепочке внутри `useEffect` (загрузчик экрана) — отказ не обработан.
import { stripComments } from './gate-strip-comments.mjs';
import { matchBrace, matchParen, lineAt, skipString } from './gate-balance.mjs';

const OUTCOME_RE =
  /\b(set\w*(?:Error|Err|Fail|Failed|Failure)\w*)\s*\(|\b(set\w*)\s*\(\s*(?:'(?:error|failed|fail)'|\{\s*kind:\s*'(?:error|failed)')/g;
/** Статусы, которые в catch выдают сбой за обычное состояние экрана. */
export const NEUTRAL_STATUSES = ['idle', 'empty', 'none', 'initial', 'hidden', 'closed', 'ready', 'done'];
const ALT = NEUTRAL_STATUSES.join('|');
const NEUTRAL_RE = new RegExp(
  `^\\s*(?:false|null|undefined|\\[\\s*\\]|''|""|\\{\\s*\\}|0|'(?:${ALT})'|"(?:${ALT})"|\\{\\s*kind:\\s*'(?:${ALT})'\\s*\\})\\s*\\)`,
);
export const REPORT_RE = /\b(?:report[A-Z]\w*|handleLoadFailure|handleBookingFailure)\s*\(/;

function catchOutcomes(src, out) {
  const re = /\bcatch\s*(?:\(\s*[\w$]*\s*(?::\s*\w+\s*)?\))?\s*\{|\.catch\(/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const close = m[0].startsWith('.') ? matchParen(src, open) : matchBrace(src, open);
    if (close === -1) continue;
    const body = src.slice(open, close + 1);
    const setters = new Set([...body.matchAll(OUTCOME_RE)].map((x) => x[1] ?? x[2]));
    const reports = REPORT_RE.test(body);
    const line = lineAt(src, m.index);
    const calls = [...body.matchAll(/\b(set[A-Z]\w*)\s*\(/g)];
    const empty = calls.find((c) => NEUTRAL_RE.test(body.slice(c.index + c[0].length)));
    if (!setters.size && empty && !reports) out.push({ setter: empty[1], reports: false, kind: 'neutral', line });
    for (const setter of setters) out.push({ setter, reports, line });
  }
}

/** Начало выражения, которому принадлежит `.then` на i, и символ-граница перед ним. */
function statementStart(src, i) {
  let depth = 0;
  for (let j = i - 1; j >= 0; j -= 1) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') continue;
    if (')]}'.includes(c)) depth += 1;
    else if ('([{'.includes(c)) {
      if (depth === 0) return { at: j + 1, stop: c };
      depth -= 1;
    } else if (depth === 0 && (c === ';' || c === ',')) return { at: j + 1, stop: c };
    else if (depth === 0 && c === '>' && src[j - 1] === '=') return { at: j + 1, stop: '=>' };
  }
  return { at: 0, stop: ';' };
}

/** Запятая верхнего уровня в аргументах (`.then(ok, fail)` — отказ обработан). */
function hasTopLevelComma(src, open, close) {
  let depth = 0;
  for (let j = open + 1; j < close; j += 1) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { j = skipString(src, j); continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) return true;
  }
  return false;
}

/** Конец цепочки после `)` на close; -1 — в цепочке есть `.catch(`. */
function chainEnd(src, close) {
  let k = close + 1;
  for (;;) {
    const next = /^\s*\.(then|finally|catch)\(/.exec(src.slice(k, k + 200));
    if (!next) return k;
    if (next[1] === 'catch') return -1;
    const end = matchParen(src, k + next[0].length - 1);
    if (end === -1) return k;
    k = end + 1;
  }
}

/** Диапазоны тел `useEffect(…)` — там живут загрузчики экрана. */
function effectRanges(src) {
  return [...src.matchAll(/\buseEffect\(/g)].map((e) => [e.index, matchParen(src, e.index + e[0].length - 1)]);
}

function unhandledThens(src, out) {
  const effects = effectRanges(src);
  const re = /\.then\(/g;
  let seenUntil = -1;
  let m;
  while ((m = re.exec(src))) {
    if (m.index < seenUntil || !effects.some(([a, b]) => m.index > a && m.index < b)) continue;
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    if (close === -1) continue;
    const setter = src.slice(open, close).match(/\b(set[A-Z]\w*)\b/);
    if (!setter || hasTopLevelComma(src, open, close)) continue;
    const end = chainEnd(src, close);
    if (end === -1) continue;
    const { at, stop } = statementStart(src, m.index);
    const head = src.slice(at, m.index).trim();
    // Промис ушёл дальше (аргумент, элемент, return, await, присваивание) — отказ ловит получатель.
    if ('(,['.includes(stop) || /^(?:return|await|yield)\b|^(?:const|let|var)\s|^[\w$.]+\s*=(?![=>])/.test(head)) continue;
    seenUntil = end;
    out.push({ setter: setter[1], reports: false, kind: 'unhandled', line: lineAt(src, m.index) });
  }
}

/** Исходы-тупики файла: [{ setter, reports, kind?, line }]. */
export function findOutcomes(rawSrc) {
  const src = stripComments(rawSrc);
  const out = [];
  catchOutcomes(src, out);
  unhandledThens(src, out);
  return out;
}
