// Дыхание 4-4-6 (экран «Здесь и сейчас», дизайн-макет; волна 2 нейродизайна).
// Чистая логика фаз — отдельно от компонента, чтобы покрыть тестом
// (правило CLAUDE.md «Тесты»): вдох 4 с → задержка 4 с → выдох 6 с, по кругу.

export type BreathPhase = 'in' | 'hold' | 'out';

export const BREATH_IN_S = 4;
export const BREATH_HOLD_S = 4;
export const BREATH_OUT_S = 6;
export const BREATH_CYCLE_S = BREATH_IN_S + BREATH_HOLD_S + BREATH_OUT_S;

export interface BreathState {
  phase: BreathPhase;
  /** Сколько секунд осталось в текущей фазе (целое, ≥1 — для отсчёта на экране) */
  secondsLeft: number;
  /** Номер круга, с 1 */
  cycle: number;
}

/** Состояние дыхания на elapsed-й секунде сессии (elapsed ≥ 0, целые секунды). */
export function breathStateAt(elapsedSec: number): BreathState {
  const t = Math.max(0, Math.floor(elapsedSec));
  const inCycle = t % BREATH_CYCLE_S;
  const cycle = Math.floor(t / BREATH_CYCLE_S) + 1;
  if (inCycle < BREATH_IN_S) {
    return { phase: 'in', secondsLeft: BREATH_IN_S - inCycle, cycle };
  }
  if (inCycle < BREATH_IN_S + BREATH_HOLD_S) {
    return {
      phase: 'hold',
      secondsLeft: BREATH_IN_S + BREATH_HOLD_S - inCycle,
      cycle,
    };
  }
  return { phase: 'out', secondsLeft: BREATH_CYCLE_S - inCycle, cycle };
}

export const BREATH_PHASE_LABEL: Record<BreathPhase, string> = {
  in: 'Вдох',
  hold: 'Задержка',
  out: 'Выдох',
};
