// Фазы круга дыхания 4-4-6 по порядку — подписи полосы фаз («вдох 4») и длина каждого отрезка.
// Те же секунды, что у таймера (breathing.ts), и те же слова, что строка подсказки (breathingText).
import {
  BREATH_HOLD_S,
  BREATH_IN_S,
  BREATH_OUT_S,
  BREATH_PHASE_LABEL,
  type BreathPhase,
} from './breathing';

export interface BreathPhaseMark {
  id: BreathPhase;
  /** «вдох 4» */
  label: string;
  seconds: number;
}

export const BREATH_PHASES: readonly BreathPhaseMark[] = (
  [
    ['in', BREATH_IN_S],
    ['hold', BREATH_HOLD_S],
    ['out', BREATH_OUT_S],
  ] as const
).map(([id, seconds]) => ({
  id,
  seconds,
  label: `${BREATH_PHASE_LABEL[id].toLowerCase()} ${seconds}`,
}));
