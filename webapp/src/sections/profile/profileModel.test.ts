import { describe, it, expect } from 'vitest';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';
import {
  utcDateStr, dayLevel, buildLevelMap, buildHeatWeeks, monthLabels, daysWord,
  achievementProgress, avatarInitial, trendKind, heatWeeksForWidth, patternBarPercent,
} from './profileModel';

describe('dayLevel', () => {
  it('по числу оценённых потребностей', () => {
    expect(dayLevel(undefined)).toBe(0);
    expect(dayLevel({})).toBe(0);
    expect(dayLevel({ a: 5 })).toBe(1);
    expect(dayLevel({ a: 5, b: 6 })).toBe(1);
    expect(dayLevel({ a: 5, b: 6, c: 1 })).toBe(2);
    expect(dayLevel({ a: 1, b: 1, c: 1, d: 1, e: 1 })).toBe(3);
  });
});

describe('buildLevelMap', () => {
  it('день без оценок всё равно уровень 1', () => {
    const m = buildLevelMap([{ date: '2026-10-01', ratings: {} }, { date: '2026-10-02', ratings: { a: 1, b: 2, c: 3 } }]);
    expect(m.get('2026-10-01')).toBe(1);
    expect(m.get('2026-10-02')).toBe(2);
  });
});

describe('buildHeatWeeks', () => {
  const today = new Date(Date.UTC(2026, 9, 15, 12)); // чт 15 окт 2026, полдень UTC
  const weeks = buildHeatWeeks(new Map([['2026-10-15', 3], ['2026-10-14', 1]]), today);
  it('18 недель по 7 дней, неделя начинается с понедельника', () => {
    expect(weeks).toHaveLength(18);
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(weeks[17][0].dateStr).toBe('2026-10-12');
  });
  it('уровни из карты, будущие дни помечены и без уровня', () => {
    expect(weeks[17][3]).toEqual({ dateStr: '2026-10-15', level: 3, future: false });
    expect(weeks[17][2].level).toBe(1);
    expect(weeks[17][4].future).toBe(true);
    expect(weeks[17][6].future).toBe(true);
  });
  it('сетка — календарные дни UTC в любой зоне машины (правило №25)', () => {
    // 23:30 UTC 15 окт — в Сиднее уже 16-е, но день истории сервера ещё 15-й.
    const late = new Date(Date.UTC(2026, 9, 15, 23, 30));
    forEachTimeZone(() => {
      const w = buildHeatWeeks(new Map([['2026-10-15', 2]]), late);
      expect(w[17][3]).toEqual({ dateStr: '2026-10-15', level: 2, future: false });
      expect(w[17][0].dateStr).toBe('2026-10-12');
    });
  });
  it('пустая карта — все уровни 0', () => {
    expect(buildHeatWeeks(new Map(), today).flat().every(c => c.level === 0)).toBe(true);
  });
});

describe('monthLabels', () => {
  it('подпись только там, где месяц меняется', () => {
    const labels = monthLabels(buildHeatWeeks(new Map(), new Date(Date.UTC(2026, 9, 15, 12))));
    expect(labels).toHaveLength(18);
    expect(labels[0]).not.toBe('');
    expect(labels.filter(Boolean).length).toBeGreaterThanOrEqual(4);
    expect(labels[1] === labels[0]).toBe(false);
  });
});

describe('мелкие функции', () => {
  it('utcDateStr — календарный день UTC', () => {
    expect(utcDateStr(new Date(Date.UTC(2026, 0, 5, 23, 30)))).toBe('2026-01-05');
  });
  it('daysWord', () => {
    expect([1, 2, 5, 11, 21, 12].map(daysWord)).toEqual(['день', 'дня', 'дней', 'дней', 'день', 'дней']);
  });
  it('achievementProgress', () => {
    expect(achievementProgress('streak_7', false, 5, 20)).toBe('5/7');
    expect(achievementProgress('total_50', false, 5, 20)).toBe('20/50');
    expect(achievementProgress('streak_7', false, 0, 20)).toBeNull();
    expect(achievementProgress('streak_7', true, 5, 20)).toBeNull();
    expect(achievementProgress('growth', false, 5, 20)).toBeNull();
  });
  it('avatarInitial / trendKind', () => {
    expect(avatarInitial(' анна')).toBe('А');
    expect(avatarInitial(null)).toBe('•');
    expect(trendKind('↑')).toBe('up');
    expect(trendKind('↓')).toBe('down');
    expect(trendKind('→')).toBe('flat');
  });
});

describe('heatWeeksForWidth', () => {
  it('шире 767 — все 18 недель', () => {
    expect(heatWeeksForWidth(768)).toBe(18);
    expect(heatWeeksForWidth(1440)).toBe(18);
  });
  it('телефон — по ширине, клетка не меньше 18px', () => {
    expect(heatWeeksForWidth(390)).toBe(14);
    expect(heatWeeksForWidth(360)).toBe(13);
    expect(heatWeeksForWidth(320)).toBe(11);
  });
  it('верхний телефон не выходит за 16, узкий не падает ниже 8', () => {
    expect(heatWeeksForWidth(767)).toBe(16);
    expect(heatWeeksForWidth(200)).toBe(8);
  });
});

describe('patternBarPercent', () => {
  it('среднее 0–10 → процент заполнения полосы', () => {
    expect(patternBarPercent(4)).toBe(40);
    expect(patternBarPercent(6.8)).toBe(68);
  });
  it('не выходит за 0–100', () => {
    expect(patternBarPercent(-1)).toBe(0);
    expect(patternBarPercent(12)).toBe(100);
    expect(patternBarPercent(null)).toBe(0);
  });
});
