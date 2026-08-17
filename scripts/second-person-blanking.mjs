#!/usr/bin/env node
// Распознавание УЖЕ разведённых форм — третий слой гейта обращения рядом с
// движком (обход, храповик, отчёт) и правилами (second-person-patterns.mjs).
// Вынесен, когда движок перерос потолок 300 строк (правило №10).
//
// Задача слоя одна: стереть содержимое строк, которые уже живут внутри
// механики форм, чтобы паттерны их не увидели. Стираем пробелами той же
// длины — построчная нумерация в отчёте остаётся верной.
import {
  CALL_ARG_EXEMPT,
  PAIR_ARRAY_ANCHOR,
} from './second-person-patterns.mjs';

// Балансировка скобок с учётом строковых литералов — общий примитив для
// «вырезать содержимое вызова/массива, сохранив переводы строк» (номера
// строк в диагностике не съезжают). openChar/closeChar параметризуют вид
// скобок: '(' / ')' для вызовов вилки/алерта, '[' / ']' для массива пар.
export function blankBalanced(src, anchorRe, afterMatch, openChar, closeChar) {
  let out = '';
  let last = 0;
  anchorRe.lastIndex = 0;
  let m;
  while ((m = anchorRe.exec(src)) !== null) {
    const start = afterMatch(m);
    if (start <= last) continue; // вложенный анкер внутри уже вырезанного
    let depth = 1;
    let quote = null;
    let i = start;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === openChar) depth++;
      else if (c === closeChar) depth--;
    }
    out += src.slice(last, start);
    out += src.slice(start, i).replace(/[^\n]/g, ' ');
    last = i;
    anchorRe.lastIndex = i;
  }
  return out + src.slice(last);
}

// Вилки форм (tr/pickForm/t) и владелец-only алерты (alertAdmin/…) — вилки
// многострочные (prettier переносит аргументы), построчная проверка не
// годится. CALL_ARG_EXEMPT — см. second-person-patterns.mjs. Лукбехинд НЕ
// исключает точку перед именем: алерты почти всегда методы (`this.notify.
// alertAdmin(`), а голых `.tr(`/`.pickForm(`/`.t(` в базе нет (греп) — сужать не для чего.
const CALL_OPEN_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_$])(${CALL_ARG_EXEMPT.join('|')})\\(`,
  'gu',
);
export function blankExemptCalls(src) {
  return blankBalanced(
    src,
    CALL_OPEN_RE,
    (m) => m.index + m[0].length,
    '(',
    ')',
  );
}

// Таблицы пар [ты-текст, вы-текст] — см. PAIR_ARRAY_ANCHOR.
export function blankPairArrays(src) {
  return blankBalanced(
    src,
    PAIR_ARRAY_ANCHOR,
    (m) => m.index + m[0].length - 1, // позиция открывающей '['
    '[',
    ']',
  );
}

// Объектные пары { ty: '…', vy: '…' } — построчно, т.к. каждое значение уже
// однострочный литерал (в отличие от вилок/массивов, где прettier переносит
// аргументы на несколько строк). Единственный реальный образец на 2026-08 —
// shared/src/components/YsqSyncErrorNote.tsx.
function keyLineRe(key) {
  return new RegExp(
    `^(\\s*${key}:\\s*)(['"\`])((?:\\\\.|(?!\\2)[^\\\\])*)\\2(.*)$`,
  );
}
const TY_KEY_RE = keyLineRe('ty');
const VY_KEY_RE = keyLineRe('vy');

// Та же пара форм, но переданная JSX-атрибутами: `<SaveErrorNote ty="…"
// vy="…" />`. Компонент-получатель разводит их у себя (`{tr(ty, vy)}`), то
// есть строки УЖЕ внутри механики — просто вилка стоит на приёмной стороне,
// а не на вызывающей. Свип 2026-08 показал, что так написаны все семь
// вызовов SaveErrorNote, и гейт считал их долгом только из-за синтаксиса.
function attrLineRe(key) {
  return new RegExp(`^(\\s*${key}=)(["'])((?:\\\\.|(?!\\2)[^\\\\])*)\\2(.*)$`);
}
const TY_ATTR_RE = attrLineRe('ty');
const VY_ATTR_RE = attrLineRe('vy');
// Однострочная запись той же пары: `<Note ty="…" vy="…" />`. Отдельно от
// построчной, потому что оба атрибута лежат в одной строке.
const TY_VY_ONE_LINE_RE =
  /(\sty=)(["'])((?:\\.|(?!\2)[^\\])*)\2(\s+vy=)(["'])((?:\\.|(?!\5)[^\\])*)\5/g;
export function blankTyVyOneLine(src) {
  return src.replace(
    TY_VY_ONE_LINE_RE,
    (_m, a, q1, t, b, q2, v) =>
      a +
      q1 +
      t.replace(/[^\n]/g, ' ') +
      q1 +
      b +
      q2 +
      v.replace(/[^\n]/g, ' ') +
      q2,
  );
}

export function blankTyVyObjectPairs(src) {
  const lines = blankTyVyOneLine(src).split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const tyM = lines[i].match(TY_KEY_RE) ?? lines[i].match(TY_ATTR_RE);
    if (!tyM) continue;
    const vyM = lines[i + 1].match(VY_KEY_RE) ?? lines[i + 1].match(VY_ATTR_RE);
    if (!vyM) continue;
    lines[i] =
      tyM[1] + tyM[2] + tyM[3].replace(/[^\n]/g, ' ') + tyM[2] + tyM[4];
    lines[i + 1] =
      vyM[1] + vyM[2] + vyM[3].replace(/[^\n]/g, ' ') + vyM[2] + vyM[4];
  }
  return lines.join('\n');
}

// Дословные внутренние цитаты («…», «…») — межличностная речь и
// самоподдержка, правило CLAUDE.md сохраняет их регистр как есть, они не
// обязаны идти через tr(). Вырезаем содержимое кавычек так же, как вырезаем
// аргументы вилки — построчную нумерацию не ломаем.
export function blankQuotedSpans(src) {
  return src
    .replace(/«[^»]*»/g, (s) => s.replace(/[^\n]/g, ' '))
    .replace(/“[^”]*”/g, (s) => s.replace(/[^\n]/g, ' '));
}
