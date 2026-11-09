// @vitest-environment jsdom
// QA 2026-11 (B-М4): вкладка «Неделя» подписана «За 7 дней», а линии шли по
// всей загруженной истории (~30 точек); маркер выбранного дня — круг внутри
// svg с preserveAspectRatio="none" — сплющивался в овал.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HistoryWeekView } from './HistoryWeekView';
import type { DayHistory, Need } from '../../types';

const NEEDS = [{ id: 'autonomy', emoji: '', title: 'Автономия', chartLabel: 'Автономия' }] as Need[];
const HISTORY: DayHistory[] = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-10-${String(30 - i).padStart(2, '0')}`,
  ratings: { autonomy: (i % 9) + 1 },
}));

function renderWeek(selectedIdx: number) {
  return render(
    <HistoryWeekView needs={NEEDS} history={HISTORY} days={7} selectedIdx={selectedIdx}
      selectedRatings={HISTORY[selectedIdx].ratings} needsLow={[]} isTherapist={false}
      bookingLink={null} onTapNeed={vi.fn()} onWeekCard={vi.fn()} />,
  );
}

describe('HistoryWeekView — «За 7 дней»', () => {
  it('линия из 7 точек, а не по всей загруженной истории', () => {
    const { container, getByText } = renderWeek(0);
    expect(getByText('За 7 дней')).toBeTruthy();
    const d = container.querySelector('.sd-spark-line')!.getAttribute('d')!;
    expect(d.match(/[ML] /g)).toHaveLength(7);
  });

  it('маркер выбранного дня — HTML-точка справа, а не круг в растянутом svg', () => {
    const { container } = renderWeek(10);
    expect(container.querySelector('svg circle')).toBeNull();
    const dot = container.querySelector<HTMLElement>('.sd-spark-dot')!;
    expect(dot.style.left).toBe('100%');
  });
});
