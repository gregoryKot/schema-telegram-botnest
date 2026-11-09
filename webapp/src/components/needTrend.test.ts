import { describe, expect, it } from 'vitest';
import { needTrend, sparkPaths } from './needTrend';

describe('needTrend', () => {
  it('растёт: последние три дня выше первых больше чем на полбалла', () => {
    const t = needTrend([8, 8, 8, 5, 4, 4, 4]); // от нового к старому
    expect(t.dir).toBe('up');
    expect(t.label).toBe('↑ Растёт');
    expect(t.diffText).toBe('+4.0');
    expect(t.recentAvg).toBe(8);
  });

  it('падает и стоит: знак разницы и подпись', () => {
    expect(needTrend([2, 2, 2, 6, 6, 6, 6])).toMatchObject({ dir: 'down', label: '↓ Падает', diffText: '-4.0' });
    expect(needTrend([5, 5, 6, 5])).toMatchObject({ dir: 'flat', label: '→ Стабильно' });
  });

  it('один день — стабильно, разница ноль; дней нет — нули без NaN', () => {
    expect(needTrend([6])).toMatchObject({ dir: 'flat', diffText: '+0.0', recentAvg: 6 });
    expect(needTrend([])).toMatchObject({ dir: 'flat', diff: 0, recentAvg: 0 });
  });
});

describe('sparkPaths', () => {
  it('линия от старого дня к новому, площадь замкнута по низу холста', () => {
    const s = sparkPaths([2, 10], 240, 52);
    expect(s.line.startsWith('M 0.0 ')).toBe(true);
    expect(s.last!.x).toBe(240);
    expect(s.area.endsWith('L 240.0 52 L 0 52 Z')).toBe(true);
  });

  it('выше оценка — выше точка; день без оценки — у самого низа', () => {
    const s = sparkPaths([1, 10], 240, 52);
    expect(s.yFor(10)).toBeLessThan(s.yFor(1));
    expect(s.yFor(0)).toBe(50);
  });

  it('пусто — без линии и последней точки', () => {
    expect(sparkPaths([], 240, 52)).toMatchObject({ line: '', area: '', last: null });
  });
});
