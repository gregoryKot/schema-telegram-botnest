// «Давление» сцены 0…1 и то, как оно красит мир: чем теснее — тем холоднее и бледнее фон.
// Чистые функции без Phaser: считает mood.ts, проверяет pressure.test.ts.

export interface PressureInput {
  /** расстояния от кота до живых врагов, px */
  dists: number[];
  /** сколько мс назад был урон; Infinity — не было */
  hurtMs: number;
  /** сколько мс подряд кот залип или вязнет */
  stuckMs: number;
  /** спираль истощения 0…1 */
  exhaustion: number;
}

const NEAR = 70, FAR = 340;          // ближе NEAR враг давит в полную силу, дальше FAR — не давит
const HURT_MS = 3200;                // урон «звенит» столько
const STUCK_FROM = 1300, STUCK_SPAN = 3200; // залипание сначала греет, потом тянет вниз
const RISE_MS = 650, FALL_MS = 2400; // накрывает быстро, отпускает медленно
const RELIEF_IN = 140, RELIEF_HOLD = 520, RELIEF_MS = 1500;

const DAWN_MAX = 0.24;                // потолок рассветной подсветки: на синем часе гл.3 слабее не видно

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Куда стремится давление при таком состоянии сцены. */
export function pressureTarget(i: PressureInput): number {
  let calm = 1;
  for (const d of i.dists) calm *= 1 - 0.55 * clamp01((FAR - d) / (FAR - NEAR));
  calm *= 1 - 0.6 * clamp01(1 - i.hurtMs / HURT_MS);
  calm *= 1 - 0.5 * clamp01((i.stuckMs - STUCK_FROM) / STUCK_SPAN);
  calm *= 1 - 0.45 * clamp01(i.exhaustion);
  return 1 - calm;
}

/** Шаг сглаживания: к цели без рывков, вверх быстрее, чем вниз. */
export function stepPressure(cur: number, target: number, dt: number): number {
  return target > cur ? Math.min(target, cur + dt / RISE_MS) : Math.max(target, cur - dt / FALL_MS);
}

/** Облегчение от копинга: вспышка тепла и откат к нулю; чем выжатее кот, тем слабее. */
export function reliefAt(msSince: number, exhaustion: number): number {
  if (msSince < 0 || msSince >= RELIEF_MS) return 0;
  const shape = msSince < RELIEF_IN ? msSince / RELIEF_IN
    : msSince < RELIEF_HOLD ? 1
    : 1 - (msSince - RELIEF_HOLD) / (RELIEF_MS - RELIEF_HOLD);
  return shape * (1 - 0.5 * clamp01(exhaustion));
}

/** Базовое тепло главы: в главах терапии выше и растёт к финалу (progress 0…1 по уровню). */
export function chapterWarmth(chapterId: string, progress: number): number {
  const p = clamp01(progress);
  if (chapterId === 'chapter3') return 0.2 + 0.5 * p;
  if (chapterId === 'chapter4') return 0.75 + 0.25 * p;
  return 0;
}

export interface MoodLook {
  /** холодная серо-синяя дымка поверх мира: уводит тепло и насыщенность */
  wash: number;
  /** тёплый круг света вокруг кота — он не остывает */
  glow: number;
  /** рассветная подсветка мира в главах терапии (ADD) */
  dawn: number;
}

export function moodLook(pressure: number, relief: number, warmth: number): MoodLook {
  const chill = clamp01(pressure) * (1 - 0.85 * clamp01(relief)) * (1 - 0.5 * clamp01(warmth));
  return {
    wash: 0.58 * chill,
    glow: 0.12 + 0.3 * chill + 0.3 * clamp01(relief),
    dawn: DAWN_MAX * clamp01(warmth) * (1 - chill),
  };
}
