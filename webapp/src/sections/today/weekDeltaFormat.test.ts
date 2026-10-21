import { describe, it, expect } from 'vitest';
import { formatWeekDelta, weekDeltaTone } from './weekDeltaFormat';

describe('formatWeekDelta / weekDeltaTone', () => {
  it('нет данных — «—», а не ноль', () => {
    expect(formatWeekDelta(null)).toBe('—');
    expect(formatWeekDelta(Number.NaN)).toBe('—');
    expect(weekDeltaTone(null)).toBe('flat');
  });
  it('дельта, округлённая до нуля, — без знака (не «−0.0»)', () => {
    expect(formatWeekDelta(-0.04)).toBe('0.0');
    expect(formatWeekDelta(0.04)).toBe('0.0');
    expect(formatWeekDelta(0)).toBe('0.0');
    expect(weekDeltaTone(-0.04)).toBe('flat');
  });
  it('рост — с плюсом, падение — с минусом', () => {
    expect(formatWeekDelta(0.46)).toBe('+0.5');
    expect(formatWeekDelta(-1.23)).toBe('−1.2');
    expect(weekDeltaTone(0.46)).toBe('up');
    expect(weekDeltaTone(-1.23)).toBe('down');
  });
});
