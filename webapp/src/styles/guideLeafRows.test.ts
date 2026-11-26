// @vitest-environment node
// «Справочник»: строки лежат прямо на цветном листе группы между линиями (решение В1 #1674) — ни белой коробки
// списка, ни белой плитки, ни мягкой тени. CSS в jsdom не исполняется — сверяем исходники.
import { describe, expect, it } from 'vitest';
import { parseRules, readCss, type Rule } from './cssRules.test-helpers';

const ROW = /\.(gr-rows?|gd-rows?|gd-cards?)\b(?!-)/;
const WHITE = /background(-color)?:[^;]*var\(--surface\)/;
const SHADOW = /box-shadow:[^;]*var\(--shadow/;
const LEAF_ROWS = '.gr-list .pp-paper .sg-rows.gr-rows';

/** Правила строк справочника с белым фоном или мягкой тенью; бумажные строки (`--paper`) красятся своим оттенком. */
const whiteRows = (rules: Rule[]): string[] => rules
  .filter((r) => r.selectors.some((s) => ROW.test(s) && !s.includes('--paper')) && (WHITE.test(r.body) || SHADOW.test(r.body)))
  .map((r) => r.selectors.join(', '));
/** Белый список примитива SignGroup (.sg-rows) на листе группы снят правилом справочника. Линия — не светлая
 *  --paper-sunk: на цветном листе её не видно, колонка сливалась в сплошную плашку (жалоба 2026-11-26). */
const leafCleared = (rules: Rule[]): boolean =>
  rules.some((r) => r.selectors.includes(LEAF_ROWS) && /background:\s*none/.test(r.body) && /border-top:/.test(r.body) && !/paper-sunk/.test(r.body));

describe('справочник: строки на листе группы без белой коробки и тени', () => {
  const rules = [...readCss('guide-reference.css'), ...readCss('therapist-guide.css')];
  it('ни одно правило строк не красит фон белым и не даёт тень', () => {
    expect(whiteRows(rules)).toEqual([]);
  });
  it('белый список SignGroup на листе снят, строки отделены линией', () => {
    expect(leafCleared(rules)).toBe(true);
  });
  it('красный образец: белая коробка с тенью и линия --paper-sunk на цветном листе', () => {
    const bad = parseRules(`.gd-rows { background: var(--surface); box-shadow: var(--shadow-1); } .gr-list--tiles .gr-rows > .gr-row:hover { background: color-mix(in srgb, var(--paper-tint) 60%, var(--surface)); } ${LEAF_ROWS} { border-top: 1px solid var(--paper-sunk); background: none; }`);
    expect(whiteRows(bad)).toEqual(['.gd-rows', '.gr-list--tiles .gr-rows > .gr-row:hover']);
    expect(leafCleared(bad)).toBe(false);
  });
  it('контрольный образец: бумажная строка своего оттенка и строки на линиях проходят', () => {
    const ok = parseRules(`.gr-list .gr-rows > .gr-row.gr-row--paper { background: var(--surface); } .gd-card-head { background: var(--surface); } ${LEAF_ROWS} { border-top: 1px solid var(--line); background: none; }`);
    expect(whiteRows(ok)).toEqual([]);
    expect(leafCleared(ok)).toBe(true);
  });
});
