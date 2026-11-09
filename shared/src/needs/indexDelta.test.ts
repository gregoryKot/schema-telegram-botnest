import { describe, it, expect } from 'vitest';
import { deltaSign, fmtIndexDelta } from './indexDelta';

describe('fmtIndexDelta', () => {
  it('знак всегда: «+2,0», «−1,5» (типографский минус), ноль — с плюсом', () => {
    expect(fmtIndexDelta(2)).toBe('+2,0');
    expect(fmtIndexDelta(-1.46)).toBe('−1,5');
    expect(fmtIndexDelta(0)).toBe('+0,0');
  });

  // Ревью g2 r4: знак брался от неокруглённой разницы — −0,04 давало «−0,0 к предыдущей неделе».
  it('знак — по разнице, округлённой до десятых: около нуля — «+0,0», без «−0,0»', () => {
    expect(fmtIndexDelta(-0.04)).toBe('+0,0');
    expect(fmtIndexDelta(0.04)).toBe('+0,0');
    expect(fmtIndexDelta(-0.05)).toBe('−0,1');
    expect(fmtIndexDelta(-0.06)).toBe('−0,1');
  });

  it('deltaSign — знак того же показанного числа: текст и цвет рядом не расходятся', () => {
    expect([2, 0, 0.04, -0.04, -0.05, -1.46].map(deltaSign)).toEqual([
      1, 1, 1, 1, -1, -1,
    ]);
  });
});
