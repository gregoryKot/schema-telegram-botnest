// Бег «Недели» — чистая логика: Саша движется сам, игрок только прыгает и выбирает действия.
// Останавливает бег одно — удержание ПАУЗЫ; после названия сбоя остаётся шаг.

export type Pace = 'walk' | 'jog' | 'run';
/** px/с: шаг спокойных кадров, трусца по дороге, бег в сбое; trudge — когда сил нет. */
export const PACE = { walk: 80, jog: 150, run: 230, trudge: 45 } as const;

export interface RunInput {
  pace: Pace;       // темп этого места главы
  resting: boolean; // силы на нуле — Саша плетётся
  named: boolean;   // сбой назван
  hold: number;     // доля удержания ПАУЗЫ, 0..1
  sitting?: boolean; // сил нет совсем — сидит
}

/** Скорость Саши сейчас. Удержание ПАУЗЫ тормозит до полной остановки; привычки бег не останавливают. */
export function runSpeed({ pace, resting, named, hold, sitting }: RunInput): number {
  if (named) return PACE.walk;
  if (sitting) return 0;
  const base = resting ? PACE.trudge : PACE[pace];
  return base * (1 - Math.min(1, Math.max(0, hold)));
}

/** Сколько секунд чистого хода от старта до точки x: темп меняют места главы (beats). */
export function secondsTo(startX: number, startPace: Pace, beats: { x: number; pace?: Pace }[], x: number): number {
  let at = startX, pace = startPace, sec = 0;
  for (const b of beats) {
    if (b.x >= x) break;
    sec += (b.x - at) / PACE[pace];
    at = b.x;
    if (b.pace) pace = b.pace;
  }
  return sec + (x - at) / PACE[pace];
}
