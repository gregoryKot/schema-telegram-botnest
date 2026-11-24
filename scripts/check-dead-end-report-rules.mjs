// Правила гейта check-dead-end-report.mjs: что считать исходом-тупиком в коде экрана.
//   1. catch с исходом-ошибкой: сеттер с Error/Err/Fail в имени или с исходом-литералом.
//   2. catch без отчёта, где хоть один сеттер ставит пустое (`false`, `null`, `[]`, `''`)
//      или нейтральный статус из NEUTRAL_STATUSES — «пусто»/«ничего не было» вместо сбоя.
//   3. `.then(…set…)` без `.catch` в цепочке внутри `useEffect` (загрузчик экрана) — отказ не обработан;
//      промис, отданный дальше (аргумент, присваивание, `return`), прослеживается до получателя.
//   4. `async`-загрузчик экрана с `await` вне `try…catch`, чей вызов никто не ловит.
//   Правила 3–4 ведёт dead-end-report-flow.mjs.
import { stripComments } from './gate-strip-comments.mjs';
import { matchBrace, matchParen, lineAt } from './gate-balance.mjs';
import { parseBlocks } from './dead-end-report-blocks.mjs';
import { chainEnd, hasTopLevelComma, inRanges, unhandled, unguardedLoaders } from './dead-end-report-flow.mjs';

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

/** Диапазоны тел `useEffect(…)` — там живут загрузчики экрана. */
function effectRanges(src) {
  return [...src.matchAll(/\buseEffect\(/g)].map((e) => [e.index, matchParen(src, e.index + e[0].length - 1)]);
}

function unhandledThens(src, ctx, out) {
  const re = /\.then\(/g;
  let seenUntil = -1;
  let m;
  while ((m = re.exec(src))) {
    if (m.index < seenUntil || !inRanges(ctx.effects, m.index)) continue;
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    if (close === -1) continue;
    const setter = src.slice(open, close).match(/\b(set[A-Z]\w*)\b/);
    if (!setter || hasTopLevelComma(src, open, close)) continue;
    const end = chainEnd(src, close);
    if (end === -1) continue;
    seenUntil = end;
    if (!unhandled(src, ctx, m.index)) continue;
    out.push({ setter: setter[1], reports: false, kind: 'unhandled', line: lineAt(src, m.index) });
  }
}

/** Исходы-тупики файла: [{ setter, reports, kind?, line }]. */
export function findOutcomes(rawSrc) {
  const src = stripComments(rawSrc);
  const out = [];
  const ctx = { blocks: parseBlocks(src), effects: effectRanges(src) };
  catchOutcomes(src, out);
  unhandledThens(src, ctx, out);
  unguardedLoaders(src, ctx, out);
  return out;
}
