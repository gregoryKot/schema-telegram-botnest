import { describe, expect, it } from 'vitest';
import { needTrend } from './needTrend';

describe('needTrend', () => {
  it('растёт: последние три дня выше первых больше чем на полбалла', () => {
    const t = needTrend([8, 8, 8, 5, 4, 4, 4]); // от нового к старому
    expect(t.dir).toBe('up');
    expect(t.label).toBe('↑ Растёт');
    expect(t.diffText).toBe('+4,0');
    expect(t.recentAvg).toBe(8);
  });

  it('падает и стоит: знак разницы и подпись; минус типографский, запятая — как у индекса дня', () => {
    expect(needTrend([2, 2, 2, 6, 6, 6, 6])).toMatchObject({
      dir: 'down',
      label: '↓ Падает',
      diffText: '−4,0',
    });
    expect(needTrend([5, 5, 6, 5])).toMatchObject({
      dir: 'flat',
      label: '→ Стабильно',
    });
  });

  it('дробная разница — запятой (fmtIndex), а не точкой', () => {
    expect(needTrend([8, 8, 7, 5, 5, 5]).diffText).toBe('+2,7');
  });

  it('один день — стабильно, разница ноль; дней нет — нули без NaN', () => {
    expect(needTrend([6])).toMatchObject({
      dir: 'flat',
      diffText: '+0,0',
      recentAvg: 6,
    });
    expect(needTrend([])).toMatchObject({ dir: 'flat', diff: 0, recentAvg: 0 });
  });
});
