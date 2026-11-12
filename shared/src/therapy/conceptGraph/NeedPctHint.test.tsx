// @vitest-environment jsdom
// Строка про проценты потребностей в «Как читать схему»: пока в колесе нет
// оценок — где их ставят, с оценками — что значит заливка. Только у терапевта:
// в схеме клиента (ConceptGraphView) ни подсказки, ни переключателя периода нет.
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Harness } from './ConceptGraph.test-helpers';
import { ConceptGraphView } from './ConceptGraphView';
import { NEED_PCT_EMPTY, NEED_PCT_LEGEND } from './NeedPctHint';
import type { ConceptNeedLink } from './needLinks';

const WHEEL: ConceptNeedLink[] = [
  { needId: 'attachment', ratings: { now: 5 }, notes: {} },
];
const CASE = { modeIds: ['healthy_adult'], schemaIds: ['failure'] };

const openGuide = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Как читать схему' }));

describe('подсказка про проценты потребностей', () => {
  it('оценок нет: в «Как читать схему» строка, где их ставят; на пустой схеме раскрывашки нет — она приходит с диаграммой', () => {
    const { unmount } = render(<Harness initial={{}} />);
    expect(screen.queryByText(NEED_PCT_EMPTY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Отметить схемы' }));
    openGuide();
    expect(screen.getByText(NEED_PCT_EMPTY)).toBeTruthy();
    unmount();

    render(<Harness initial={CASE} />);
    expect(screen.queryByText(NEED_PCT_EMPTY)).toBeNull();
    openGuide();
    expect(screen.getByText(NEED_PCT_EMPTY)).toBeTruthy();
    expect(screen.queryByText(NEED_PCT_LEGEND)).toBeNull();
  });

  it('оценки есть: вместо неё — что значат заливка и число', () => {
    render(<Harness initial={{ ...CASE, needLinks: WHEEL }} />);
    openGuide();
    expect(screen.getByText(NEED_PCT_LEGEND)).toBeTruthy();
    expect(screen.queryByText(NEED_PCT_EMPTY)).toBeNull();
  });

  it('подсказка не идёт в картинку схемы и звучит одинаково в обеих формах обращения', () => {
    render(<Harness initial={CASE} form="vy" />);
    openGuide();
    const hint = screen.getByText(NEED_PCT_EMPTY);
    expect(hint.closest('[data-export-skip]')).not.toBeNull();
  });

  it('схема клиента: без подсказки и без переключателя периода', () => {
    render(<ConceptGraphView fields={CASE} />);
    expect(screen.queryByText(NEED_PCT_EMPTY)).toBeNull();
    expect(document.querySelector('[data-need-pct-hint]')).toBeNull();
    expect(
      screen.queryByRole('group', { name: 'Период оценок потребностей' }),
    ).toBeNull();
  });
});
