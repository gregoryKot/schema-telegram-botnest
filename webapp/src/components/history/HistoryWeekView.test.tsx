// @vitest-environment jsdom
// QA 2026-11 (B-М4): вкладка «Неделя» подписана «За 7 дней», а линии шли по
// всей загруженной истории (~30 точек); маркер выбранного дня — круг внутри
// svg с preserveAspectRatio="none" — сплющивался в овал.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HistoryWeekView } from './HistoryWeekView';
import type { DayHistory, Need } from '../../types';
import { needDataColor } from '../needDataColor';
import { CHECK_IN_GEOM, strokeLen } from '../art/strokeLen';
import { PAPER } from '../art/paper';
import { NEED_ORDER } from '../../../../shared/src/needs/types';

const NEEDS = [{ id: 'autonomy', emoji: '', title: 'Автономия', chartLabel: 'Автономия' }] as Need[];
const HISTORY: DayHistory[] = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-10-${String(30 - i).padStart(2, '0')}`,
  ratings: { autonomy: (i % 9) + 1 },
}));

function renderWeek(selectedIdx: number, history: DayHistory[] = HISTORY) {
  return render(
    <HistoryWeekView needs={NEEDS} history={history} selectedIdx={selectedIdx}
      selectedRatings={history[selectedIdx].ratings} needsLow={[]} isTherapist={false}
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

  // Ревью g2 r4: сцена «Карточки недели» под пятью строками потребностей шла в палитре лендинга (мох, янтарь,
  // глина…), а строки — цветами данных (глина, янтарь, сланец…). Полоски = потребности: те же цвета и порядок,
  // высоты — оценки выбранного дня.
  const bars = (c: HTMLElement) => [...c.querySelectorAll('.sd-weekcard-scene svg > g:not(.scn-shade) rect[rx="10"]')];
  const DATA = NEED_ORDER.map((id) => needDataColor(id));

  it('полоски «Карточки недели» — цвета данных в порядке NEED_ORDER, высоты — оценки выбранного дня', () => {
    const full = { attachment: 8, autonomy: 3, expression: 6, play: 4, limits: 9 };
    const { container } = renderWeek(0, [{ date: '2026-10-30', ratings: full }, ...HISTORY.slice(1)]);
    const b = bars(container);
    expect(b.map((r) => r.getAttribute('fill'))).toEqual(DATA);
    expect(b.map((r) => Number(r.getAttribute('height')))).toEqual(
      NEED_ORDER.map((id) => strokeLen(full[id as keyof typeof full], CHECK_IN_GEOM)),
    );
  });

  // Ревью g2 r5: выбранный день без оценок рисовался пятью ровными полосками полным цветом данных, а частичный
  // день — цветными пеньками высотой ниже оценки 1. Пустой день — пустое место, как в ленте дат над сценой:
  // неоценённая полоска — data-rated="no", пустой тон (PAPER.hollow → правило .pp-strokes-values), ни одной
  // полоски цветом данных.
  it('день без оценок — ни одной полоски цветом данных, все пустым тоном', () => {
    const history = [{ date: '2026-10-30', ratings: {} }, ...HISTORY.slice(1)];
    const b = bars(renderWeek(0, history).container);
    expect(b).toHaveLength(5);
    expect(b.filter((r) => DATA.includes(r.getAttribute('fill') ?? ''))).toHaveLength(0);
    expect(b.every((r) => r.getAttribute('data-rated') === 'no' && r.getAttribute('fill') === PAPER.hollow)).toBe(true);
  });

  it('частичный день — цвет данных только у оценённой, неоценённые пустым тоном, не пеньком ниже оценки 1', () => {
    const history = [{ date: '2026-10-30', ratings: { play: 6 } }, ...HISTORY.slice(1)];
    const b = bars(renderWeek(0, history).container);
    const play = NEED_ORDER.indexOf('play');
    expect(b[play].getAttribute('fill')).toBe(needDataColor('play'));
    expect(b[play].getAttribute('data-rated')).toBe('yes');
    const rest = b.filter((_, i) => i !== play);
    expect(rest.every((r) => r.getAttribute('data-rated') === 'no' && r.getAttribute('fill') === PAPER.hollow)).toBe(true);
    // Пустое место выше оценки 1 — его не прочесть как очень низкую оценку.
    expect(Math.min(...rest.map((r) => Number(r.getAttribute('height'))))).toBeGreaterThan(strokeLen(1, CHECK_IN_GEOM));
  });
});
