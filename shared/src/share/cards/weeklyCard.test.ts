// @vitest-environment jsdom
// Карточка недели трекера — чистые расчёты (среднее по потребности за
// неделю, диапазон дат, индекс недели, текст шаринга кратким/детальным).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calcWeekAvg,
  weekRange,
  weekIndex,
  buildWeeklyShareText,
  drawWeeklyCard,
} from './weeklyCard';
import { canvasWithMockCtx, printedText } from './canvas.test-helpers';
import type { Need, DayHistory } from '../../types';

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автоном.' },
];

const history: DayHistory[] = [
  { date: '2026-07-13', ratings: { attachment: 6, autonomy: 4 } },
  { date: '2026-07-14', ratings: { attachment: 8 } },
  { date: '2026-07-16', ratings: { autonomy: 8 } },
];

describe('calcWeekAvg', () => {
  it('среднее только по дням, где потребность отмечена', () => {
    expect(calcWeekAvg(history, 'attachment')).toBe(7); // (6+8)/2
  });

  it('потребность нигде не отмечена — null, не 0', () => {
    expect(calcWeekAvg(history, 'expression')).toBeNull();
  });

  it('пустая история — null', () => {
    expect(calcWeekAvg([], 'attachment')).toBeNull();
  });
});

describe('weekRange', () => {
  // fmtDate показывает год, если он не текущий: часы закреплены за 2026.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('две и более дат — «первая — последняя» по возрастанию', () => {
    expect(weekRange(history)).toBe('13 июл — 16 июл');
  });

  it('одна дата — без диапазона', () => {
    expect(weekRange([{ date: '2026-07-13', ratings: {} }])).toBe('13 июл');
  });

  it('пустая история — пустая строка', () => {
    expect(weekRange([])).toBe('');
  });
});

describe('weekIndex', () => {
  it('среднее по средним каждой потребности', () => {
    // attachment avg=7, autonomy avg=6 → (7+6)/2 = 6.5
    expect(weekIndex(NEEDS, history)).toBe(6.5);
  });

  it('ни одна потребность не заполнена — null', () => {
    expect(weekIndex(NEEDS, [])).toBeNull();
  });
});

describe('buildWeeklyShareText', () => {
  it('краткий вариант: диапазон, индекс, серия только если streak > 0', () => {
    const withStreak = buildWeeklyShareText(NEEDS, history, 5, false, 'link');
    expect(withStreak).toContain('Серия: 5 дней');
    const noStreak = buildWeeklyShareText(NEEDS, history, 0, false, 'link');
    expect(noStreak).not.toContain('Серия');
  });

  it('детальный вариант перечисляет каждую потребность со своим средним', () => {
    const text = buildWeeklyShareText(NEEDS, history, 0, true, 'link');
    expect(text).toContain('Привяз.: 7,0');
    expect(text).toContain('Автоном.: 6,0');
    expect(text).toContain('Индекс: 6,5/10');
  });

  it('детальный вариант: незаполненная потребность — «—», не 0.0', () => {
    const text = buildWeeklyShareText(
      [
        ...NEEDS,
        { id: 'play', emoji: '🎉', title: 'Игра', chartLabel: 'Игра' },
      ],
      history,
      0,
      true,
      'link',
    );
    expect(text).toContain('Игра: —');
  });
});

// Индекс и средние — десятичной запятой, как на экранах (fmtIndex, shared/src/needs/dayIndex.ts).
// Ширина строк на холсте при этом не меняется: в Chromium «6,4» и «6.4» шрифтом карточек
// (bold 24 и bold 14) — ровно одной ширины (замер 2026-11-08), колонка значений выровнена вправо.
describe('drawWeeklyCard — числа на картинке', () => {
  it('центр радара и значения строк — «6,5», «7,0», без точки', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawWeeklyCard(canvas, NEEDS, history, 0);
    const printed = printedText(ctx);
    expect(printed).toContain('6,5');
    expect(printed).toContain('7,0');
    expect(printed).not.toMatch(/\d\.\d/);
  });
});

describe('weekDays — семь календарных дней до последнего отмеченного', () => {
  it('пропущенный день остаётся пустым листом, а не выпадает', async () => {
    const { weekDays } = await import('./weeklyCard');
    const days = weekDays([
      { date: '2026-11-12', ratings: { attachment: 5 } },
      { date: '2026-11-09', ratings: { attachment: 2 } },
    ]);
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
    expect(days[3].ratings).toEqual({ attachment: 2 });
    expect(days[0].ratings).toBeNull();
    expect(weekDays([])).toEqual([]);
  });
});
