// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  deltaView,
  dayIndex,
  buildHistory,
  weekDelta,
  sparkBars,
  mergeRecentEntries,
  meetingTitle,
} from './model';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

describe('deltaView', () => {
  it('рост и падение со стрелкой, целые без дробной части', () => {
    expect(deltaView(8, 5)).toEqual({ text: '↑3', up: true });
    expect(deltaView(4, 6)).toEqual({ text: '↓2', up: false });
    expect(deltaView(5.5, 5)).toEqual({ text: '↑0.5', up: true });
  });
  it('нет вчерашней или сегодняшней оценки, либо разницы — null', () => {
    expect(deltaView(5, undefined)).toBeNull();
    expect(deltaView(undefined, 5)).toBeNull();
    expect(deltaView(5, 5)).toBeNull();
  });
});

describe('dayIndex', () => {
  it('среднее, когда оценены все потребности', () => {
    expect(dayIndex(['a', 'b'], { a: 4, b: 7 })).toBe(5.5);
  });
  it('не все оценены или потребностей нет — null', () => {
    expect(dayIndex(['a', 'b'], { a: 4 })).toBeNull();
    expect(dayIndex([], {})).toBeNull();
  });
});

describe('buildHistory / weekDelta / sparkBars', () => {
  // Календарный день истории — UTC (правило №25), как todayCalendarDate().
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  it('сортирует по дате, пустой день — 0, сегодня добавляется из живых оценок', () => {
    const vals = buildHistory([
      { date: day(1), ratings: { a: 6, b: 8 } },
      { date: day(2), ratings: {} },
    ], { a: 2, b: 4 });
    expect(vals).toEqual([0, 7, 3]);
  });

  it('сегодня уже в истории — берётся живое среднее, если оценки есть', () => {
    expect(buildHistory([{ date: day(0), ratings: { a: 1 } }], { a: 9 })).toEqual([9]);
    expect(buildHistory([{ date: day(0), ratings: { a: 1 } }], {})).toEqual([1]);
  });

  it('weekDelta: разница недель, при нехватке данных null', () => {
    const h = [...Array(7).fill(3), ...Array(7).fill(8)];
    expect(weekDelta(h)).toBe(5);
    expect(weekDelta([1, 2, 3])).toBeNull();
    expect(weekDelta([...Array(7).fill(0), ...Array(7).fill(8)])).toBeNull();
  });

  it('sparkBars: последние 14, высота в %, уровень по порогам, 0 — none', () => {
    const bars = sparkBars([...Array(6).fill(9), 0, 5, 3, 7.5]);
    expect(bars).toHaveLength(10);
    expect(bars[0]).toEqual({ height: 90, level: 'ok' });
    expect(bars[6]).toEqual({ height: 0, level: 'none' });
    expect(bars[7].level).toBe('warn');
    expect(bars[8].level).toBe('err');
    expect(sparkBars(Array(20).fill(5))).toHaveLength(14);
  });
});

describe('mergeRecentEntries', () => {
  it('склеивает три дневника, свежие первыми, максимум три, длинный текст режется', () => {
    const res = mergeRecentEntries({
      schema: [{ trigger: 'a'.repeat(80), createdAt: '2026-01-01T09:00:00Z' }],
      mode: [{ situation: 'ситуация', createdAt: '2026-01-02T10:00:00Z' }],
      gratitude: [{ items: ['кофе'], date: '2026-01-03' }, { items: [], date: '2026-01-02' }],
    });
    expect(res.map(e => e.type)).toEqual(['gratitude', 'mode', 'gratitude']);
    expect(res[2].label).toBe('Благодарность');
    expect(res).toHaveLength(3);
    expect(Object.keys(res[0])).not.toContain('sortKey');
  });
});

describe('meetingTitle', () => {
  const now = new Date(2026, 9, 15, 10, 0).getTime();
  it('сегодня / завтра по календарным дням, а не по 24 часам', () => {
    expect(meetingTitle(new Date(2026, 9, 15, 23, 30).toISOString(), now)).toMatch(/^Сегодня · /);
    expect(meetingTitle(new Date(2026, 9, 16, 0, 30).toISOString(), now)).toMatch(/^Завтра · /);
  });
  it('дальше — день недели, дата и время', () => {
    expect(meetingTitle(new Date(2026, 9, 17, 14, 0).toISOString(), now)).toMatch(/^Сб, 17 октября · 14:00$/);
  });
  it('только день (дни встреч без времени) — без выдуманного времени и без сдвига дня в любой зоне', () => {
    forEachTimeZone((tz) => {
      const at = new Date(2026, 9, 15, 10, 0).getTime();
      expect(meetingTitle('2026-10-17', at), tz).toBe('Сб, 17 октября');
      expect(meetingTitle('2026-10-15', at), tz).toBe('Сегодня');
      expect(meetingTitle('2026-10-16', at), tz).toBe('Завтра');
    });
  });
});
