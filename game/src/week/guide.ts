// Подсказки «Недели» — чистая логика: что сейчас мешает Саше и какую кнопку подсветить.
// Подсказка — мысль Саши и мигающая кнопка; правил-карточек нет (game/GAME_CONCEPT.md).
import { OPENS, type Act, type GateKind } from './monday';

export type Need = Act | 'jump';
/** Сколько Саша упирается, прежде чем подсказка всплывёт (и повторится). */
export const STUCK_MS = 900, REPEAT_MS = 4000;

/** Высота прыжка в px: скорость отрыва (рюкзак её срезает) и гравитация — из PHYS. */
export const jumpHeight = (vel: number, gravity: number): number => vel ** 2 / (2 * gravity);

/** Что убирает преграду: низкое перепрыгивают, высокую стопку, шум и человека — только привычкой. */
export function needFor(kind: GateKind | 'block', h: number, jumpPx: number): Need {
  if (kind === 'block') return 'jump';
  if (kind === 'pile' && h < jumpPx - 12) return 'jump';
  return OPENS[kind];
}

export interface GuideIn {
  need: Need | null;  // что убирает преграду прямо перед Сашей (null — путь свободен)
  stuckMs: number;    // сколько Саша уже стоит, упершись
  revealed: Act[];    // какие кнопки уже есть
  peak: boolean;      // сбой на пике: помогает только ПАУЗА
  sinceHintMs: number; // сколько прошло с прошлой подсказки
}

/** Какую подсказку показать сейчас (null — молчать). На пике любая преграда ведёт к ПАУЗЕ. */
export function pickHint(g: GuideIn): Need | null {
  if (!g.need || g.stuckMs < STUCK_MS || g.sinceHintMs < REPEAT_MS) return null;
  const need = g.peak && g.revealed.includes('pause') ? 'pause' : g.need;
  return need === 'jump' || g.revealed.includes(need) ? need : null;
}

/** Время после старта, к которому пик обязан случиться: ПАУЗА — не позже ~2:30 при любой игре. */
export const PEAK_BY_MS = 140_000;
/** Пик пора начать раньше места главы: время вышло или телефон унёс часы к встрече. */
export function peakDue(runMs: number, clockMin: number, clockCap: number): boolean {
  return runMs >= PEAK_BY_MS || clockMin >= clockCap;
}
