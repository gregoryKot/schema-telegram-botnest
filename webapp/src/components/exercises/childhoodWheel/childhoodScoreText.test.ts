import { describe, expect, it } from 'vitest';
import { childhoodScoreText } from './childhoodScoreText';
import { NEEDS } from './needs';

const limits = NEEDS.find((n) => n.id === 'limits')!;

describe('childhoodScoreText', () => {
  it('низкий балл — нижний полюс колеса, высокий — верхний', () => {
    expect(childhoodScoreText('limits', 2)).toBe(limits.low);
    expect(childhoodScoreText('limits', 4)).toBe(limits.low);
    expect(childhoodScoreText('limits', 7)).toBe(limits.high);
    expect(childhoodScoreText('limits', 10)).toBe(limits.high);
  });

  it('середина шкалы и неизвестная потребность — без подписи', () => {
    expect(childhoodScoreText('limits', 5)).toBeNull();
    expect(childhoodScoreText('limits', 6)).toBeNull();
    expect(childhoodScoreText('unknown', 2)).toBeNull();
  });
});
