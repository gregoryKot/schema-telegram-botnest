// @vitest-environment jsdom
// Сетка групп по рядам (sheet-schemas.css, @container sg-cols 660–959) — только у «Моих схем / Моих режимов»
// (.sg-cols--rows: MineGroupsList и его силуэт). Ревью g5 r5: правило стояло на всех .sg-cols, и листы выбора схем и
// режимов тоже встали в ряды — «Детские режимы» (8 строк) рядом с «Капитуляцией» (1 строка), справа дыра ~400px.
// Сверка через шов: обёртки рендерят настоящие компоненты, совпадение селектора — element.matches, CSS — исходники.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { MineGroupsList } from '../sections/schemas/MineGroupsList';
import { MineGroupsSkeleton } from '../sections/schemas/MineGroupsSkeleton';
import { groupMineByDomain } from '../sections/schemas/mineGroups';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { ModePickerSheet } from '../components/ModePickerSheet';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { allCssRules } from './cssRules.test-helpers';

afterEach(cleanup);

const noop = () => {};
const TWO_COLS = (m: string) => /@container\s+sg-cols/.test(m) && /min-width:\s*660px/.test(m);
const GRID = /display\s*:\s*grid|grid-template-columns\s*:/;
const twoCols = allCssRules().filter((r) => TWO_COLS(r.media));
/** Правила сетки по рядам в двух колонках контейнера групп. */
const rowRules = twoCols.filter((r) => GRID.test(r.body));
/** Две CSS-колонки (columns: 2) — вид листов выбора. */
const colRules = twoCols.filter((r) => /(?:^|;)\s*columns\s*:\s*2\b/.test(r.body));

const renderCols = (ui: ReactElement): Element[] => {
  const { container } = render(<MemoryRouter>{ui}</MemoryRouter>);
  return [...container.querySelectorAll('.sg-cols')];
};
const hits = (rules: typeof twoCols, el: Element) => rules.some((r) => r.selectors.some((s) => el.matches(s)));
const inRows = (el: Element) => hits(rowRules, el);

const ids = SCHEMA_DOMAINS.flatMap((d) => d.schemas.map((s) => s.id)).slice(0, 6);
const MINE: [string, ReactElement][] = [
  ['«Мои схемы» (MineGroupsList)', <MineGroupsList key="m" kind="schema" groups={groupMineByDomain(SCHEMA_DOMAINS, ids)} nameOf={(id) => id} onAdd={noop} onOpen={noop} />],
  ['силуэт «Моих схем» (MineGroupsSkeleton)', <MineGroupsSkeleton key="s" />],
];
const PICKERS: [string, ReactElement][] = [
  ['выбор схем (SchemaPickerSheet)', <SchemaPickerSheet key="sp" selected={[]} onSave={noop} onClose={noop} />],
  ['выбор режимов (ModePickerSheet)', <ModePickerSheet key="mp" selected={[]} onSave={noop} onClose={noop} />],
];

describe('сетка групп по рядам — только у «Моих схем / режимов»', () => {
  it('правило рядов есть, и каждый его селектор привязан к .sg-cols--rows', () => {
    expect(rowRules.length).toBeGreaterThan(0);
    for (const r of rowRules) for (const s of r.selectors) expect(s, `${r.f}: ${s}`).toMatch(/\.sg-cols--rows/);
  });

  it.each(MINE)('%s: обёртка групп встаёт по рядам', (_, ui) => {
    const cols = renderCols(ui);
    expect(cols).toHaveLength(1);
    expect(inRows(cols[0])).toBe(true);
  });

  it.each(PICKERS)('%s: группы в две CSS-колонки, сетка рядов не действует', (_, ui) => {
    const cols = renderCols(ui);
    expect(cols).toHaveLength(1);
    expect(inRows(cols[0])).toBe(false);
    expect(hits(colRules, cols[0])).toBe(true);
  });
});
