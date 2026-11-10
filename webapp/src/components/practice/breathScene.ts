// Положение сцены дыхания по этапу (BreathingPaperView): какую фазу SceneBreath показать и за
// сколько секунд к ней прийти. В покое дуги стоят ровно; во время дыхания идут за фазой и
// переходят к ней ровно за её длину (вдох 4 с, задержка 4, выдох 6); на итоге ложатся. Сниженная
// анимация — дуги не двигаются вовсе, фазу несут подпись и полоса фаз.
import {
  BREATH_HOLD_S,
  BREATH_IN_S,
  BREATH_OUT_S,
  type BreathPhase,
} from '../../../../shared/src/practices/breathing';
import type { BreathStage } from '../../../../shared/src/practices/breathingText';
import type { BreathScenePhase } from '../art/AppScenes';
import { stepMarks, type StepMark } from './stepCounterModel';

const PHASE_S: Record<BreathPhase, number> = { in: BREATH_IN_S, hold: BREATH_HOLD_S, out: BREATH_OUT_S };
/** Дуги ложатся на итоге — спокойнее выдоха, но не рывком. */
const SETTLE_S = 2;

export function breathScenePhase(
  stage: BreathStage,
  phase: BreathPhase,
  reduced: boolean,
): { phase: BreathScenePhase; seconds?: number } {
  if (stage === 'finished') return { phase: 'rest', seconds: reduced ? undefined : SETTLE_S };
  if (stage === 'idle' || reduced) return { phase: 'out' };
  return { phase, seconds: PHASE_S[phase] };
}

const ORDER: readonly BreathPhase[] = ['in', 'hold', 'out'];

/** Отрезки полосы фаз внутри круга: пройденные, текущая (заполняется за свою длину), впереди. */
export const phaseMarks = (phase: BreathPhase): StepMark[] => stepMarks(ORDER.length, ORDER.indexOf(phase));
