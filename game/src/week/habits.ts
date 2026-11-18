// Цена привычек «Недели» — чистые функции над состоянием главы (сценарий — game/GAME_CONCEPT.md).
// Привычка срабатывает всегда и всегда чего-то стоит; проиграть нельзя: силы на нуле — Саша плетётся.

export interface WeekState {
  energy: number;    // полоска сил, 0..100
  piles: number;     // сколько стопок дел выросло от переработки
  clockMin: number;  // часы на экране, минуты от полуночи
  color: number;     // 1 — мир в цвете, 0 — серый
  load: number;      // сколько чужого в рюкзаке
  calmMs: number;    // сколько ещё сбой отступил
  calmLevel: number; // доля сбоя, пока он отступил (0 — погас)
  restMs: number;    // > 0 — сил нет, Саша плетётся
  named: boolean;    // сбой назван в ПАУЗЕ — больше не возвращается
}

export const RULES = {
  overworkCost: 30, overworkPiles: 2, overworkCalmMs: 2000, overworkCalmLevel: 0.3,
  scrollJumpMin: 130, scrollFade: 0.34, scrollCalmMs: 2500,
  agreeJumpLoss: 0.12, minJump: 0.6,
  restMs: 2200, restEnergy: 40,
  clockCap: 14 * 60 + 58, // встреча в 15:00 — телефон не уносит дальше двери
} as const;

export function newWeekState(clockMin: number): WeekState {
  return { energy: 100, piles: 0, clockMin, color: 1, load: 0, calmMs: 0, calmLevel: 0, restMs: 0, named: false };
}

/** ПЕРЕРАБОТАТЬ: сбой отступает, дел больше, сил меньше. На пике (у двери) сбой не отступает. */
export function overwork(s: WeekState, peak = false): WeekState {
  const energy = Math.max(0, s.energy - RULES.overworkCost);
  return {
    ...s, energy, piles: s.piles + RULES.overworkPiles,
    ...(peak ? {} : { calmMs: RULES.overworkCalmMs, calmLevel: RULES.overworkCalmLevel }),
    restMs: energy === 0 ? RULES.restMs : s.restMs,
  };
}

/** ПРОЛИСТАТЬ: сбой гаснет, часы перескакивают, мир сереет. На пике телефон гаснет сам — ничего не меняется. */
export function scroll(s: WeekState, peak = false): WeekState {
  if (peak) return s;
  return {
    ...s,
    clockMin: Math.max(s.clockMin, Math.min(s.clockMin + RULES.scrollJumpMin, RULES.clockCap)),
    color: Math.max(0, +(s.color - RULES.scrollFade).toFixed(2)),
    calmMs: RULES.scrollCalmMs, calmLevel: 0,
  };
}

/** СОГЛАСИТЬСЯ: рюкзак тяжелеет. Соглашаться не с кем — ничего не происходит. */
export function agree(s: WeekState, person: boolean): WeekState {
  return person ? { ...s, load: s.load + 1 } : s;
}

/** Сбой назван: он гаснет насовсем, цвет возвращается. Взятое и потраченное остаётся. */
export function nameGlitch(s: WeekState): WeekState {
  return { ...s, named: true, color: 1, calmMs: 0 };
}

/** Доля высоты прыжка: каждое взятое чужое тянет вниз, но прыжок не пропадает. */
export function jumpFactor(s: WeekState): number {
  return Math.max(RULES.minJump, 1 - RULES.agreeJumpLoss * s.load);
}

/** Сила сбоя сейчас: base — сколько его в этом месте главы (0..1). */
export function glitchLevel(s: WeekState, base: number): number {
  if (s.named) return 0;
  return s.calmMs > 0 ? base * s.calmLevel : base;
}

/** Часы идут только вперёд: место главы подтягивает их до своего времени. */
export function reachClock(s: WeekState, min: number): WeekState {
  return min > s.clockMin ? { ...s, clockMin: min } : s;
}

/** Кадр времени: отступивший сбой возвращается; отдышавшись, Саша снова бежит с частью сил. */
export function tick(s: WeekState, dtMs: number): WeekState {
  const calmMs = Math.max(0, s.calmMs - dtMs);
  if (s.restMs <= 0) return calmMs === s.calmMs ? s : { ...s, calmMs };
  const restMs = Math.max(0, s.restMs - dtMs);
  return { ...s, calmMs, restMs, energy: restMs === 0 ? RULES.restEnergy : s.energy };
}

export const isResting = (s: WeekState): boolean => s.restMs > 0;

export function clockText(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
