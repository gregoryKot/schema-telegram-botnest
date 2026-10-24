// Тесты фаз дыхания 4-4-6 («Здесь и сейчас», волна 2 нейродизайна).
import { describe, it, expect } from 'vitest';
import { breathStateAt, BREATH_CYCLE_S } from './breathing';

describe('breathStateAt', () => {
  it('вдох: секунды 0–3, отсчёт 4→1', () => {
    expect(breathStateAt(0)).toEqual({ phase: 'in', secondsLeft: 4, cycle: 1 });
    expect(breathStateAt(3)).toEqual({ phase: 'in', secondsLeft: 1, cycle: 1 });
  });

  it('задержка: секунды 4–7', () => {
    expect(breathStateAt(4)).toEqual({
      phase: 'hold',
      secondsLeft: 4,
      cycle: 1,
    });
    expect(breathStateAt(7)).toEqual({
      phase: 'hold',
      secondsLeft: 1,
      cycle: 1,
    });
  });

  it('выдох: секунды 8–13, отсчёт 6→1', () => {
    expect(breathStateAt(8)).toEqual({
      phase: 'out',
      secondsLeft: 6,
      cycle: 1,
    });
    expect(breathStateAt(13)).toEqual({
      phase: 'out',
      secondsLeft: 1,
      cycle: 1,
    });
  });

  it('цикл замыкается: 14-я секунда — снова вдох, круг 2', () => {
    expect(breathStateAt(BREATH_CYCLE_S)).toEqual({
      phase: 'in',
      secondsLeft: 4,
      cycle: 2,
    });
  });

  it('отрицательные/дробные значения не ломают', () => {
    expect(breathStateAt(-5).phase).toBe('in');
    expect(breathStateAt(4.9)).toEqual({
      phase: 'hold',
      secondsLeft: 4,
      cycle: 1,
    });
  });
});
