import { describe, expect, it } from 'vitest';
import { needTrend } from './needTrend';

// Оценки — от нового дня к старому; 0 — день без оценки.
describe('needTrend', () => {
  it('эта неделя против предыдущей: разница средних, запятая, типографский минус', () => {
    const up = needTrend([8, 8, 8, 8, 8, 8, 8], [4, 4, 4, 4, 4, 4, 4])!;
    expect(up).toMatchObject({
      dir: 'up',
      label: '↑ Растёт',
      diffText: '+4,0',
      weekAvg: 8,
    });
    expect(needTrend([2, 2, 2], [6, 6, 6])).toMatchObject({
      dir: 'down',
      label: '↓ Падает',
      diffText: '−4,0',
    });
    expect(needTrend([5, 5, 6, 5], [5, 5, 5])).toMatchObject({
      dir: 'flat',
      label: '→ Стабильно',
    });
    expect(needTrend([8, 8, 7], [5, 5, 5])!.diffText).toBe('+2,7');
  });

  // Ревью g2 r3: пропуски шли в среднее нулями — «сейчас» занижалось, тренд выдумывался.
  it('день без оценки не тянет среднее вниз ни в этой неделе, ни в прошлой', () => {
    const t = needTrend([6, 0, 6, 0, 0, 6, 0], [6, 0, 0, 0, 0, 0, 6])!;
    expect(t.weekAvg).toBe(6);
    expect(t).toMatchObject({ dir: 'flat', diffText: '+0,0' });
  });

  it('в прошлой неделе нет оценок — сравнения нет, направление внутри недели', () => {
    const t = needTrend([8, 8, 8, 0, 4, 4, 4], [0, 0])!;
    expect(t.diffText).toBeNull();
    expect(t.dir).toBe('up');
    expect(needTrend([8, 8, 8, 4, 4, 4])!.diffText).toBeNull();
  });

  it('один день — стабильно и без «+0,0»; в неделе нет оценок — null, а не нули', () => {
    expect(needTrend([6])).toMatchObject({
      dir: 'flat',
      diffText: null,
      weekAvg: 6,
    });
    expect(needTrend([0, 0, 0], [5, 5])).toBeNull();
    expect(needTrend([])).toBeNull();
  });
});
