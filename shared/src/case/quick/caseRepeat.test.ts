import { describe, expect, it } from 'vitest';
import { CASE_REPEAT_WINDOW_DAYS, modeRepeatCount } from './caseRepeat';

const at = (modeId: string, createdAt: string) => ({ modeId, createdAt });

describe('modeRepeatCount', () => {
  it('без записей — первая встреча', () => {
    expect(modeRepeatCount([], 'punitive_critic', '2026-11-25')).toBe(1);
  });

  it('считает только этот режим и только в окне двух недель', () => {
    const before = [
      at('punitive_critic', '2026-11-24T18:00:00.000Z'),
      at('punitive_critic', '2026-11-12'),
      at('punitive_critic', '2026-11-11'),
      at('angry_child', '2026-11-23T10:00:00.000Z'),
    ];
    // 24-е и 12-е (13 дней назад) в окне, 11-е (14 дней) — уже нет.
    expect(modeRepeatCount(before, 'punitive_critic', '2026-11-25')).toBe(3);
    expect(CASE_REPEAT_WINDOW_DAYS).toBe(14);
  });

  it('запись сегодня считается, будущая и битая дата — нет', () => {
    const before = [
      at('angry_child', '2026-11-25'),
      at('angry_child', '2026-11-27'),
      at('angry_child', 'не дата'),
    ];
    expect(modeRepeatCount(before, 'angry_child', '2026-11-25')).toBe(2);
  });

  it('без режима или с битым «сегодня» — первая встреча', () => {
    const before = [at('angry_child', '2026-11-25')];
    expect(modeRepeatCount(before, '', '2026-11-25')).toBe(1);
    expect(modeRepeatCount(before, 'angry_child', '')).toBe(1);
  });
});
