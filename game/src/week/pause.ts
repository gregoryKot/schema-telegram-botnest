// ПАУЗА «Недели» — чистая логика: удержание открывает выбор, верный ответ последнего шага закрывает сбой.
// Шагов бывает два («Среда»): назвать — и понять, что нужно; между шагами пауза закрывается и держится заново.

export const PAUSE_HOLD_MS = 700;

export interface PauseState {
  heldMs: number;  // сколько кнопка уже удерживается
  open: boolean;   // мир замер, идёт выбор
  tried: number[]; // неверные названия, которые уже пробовали
  named: boolean;  // пройден последний шаг
  step: number;    // какой шаг выбора сейчас (0 — назвать)
}

export const newPause = (): PauseState => ({ heldMs: 0, open: false, tried: [], named: false, step: 0 });

/** Кадр удержания: отпустили раньше срока — отсчёт заново; открытый выбор от кнопки уже не зависит. */
export function holdPause(p: PauseState, dtMs: number, held: boolean): PauseState {
  if (p.open || p.named) return p;
  if (!held) return p.heldMs === 0 ? p : { ...p, heldMs: 0 };
  const heldMs = p.heldMs + dtMs;
  return heldMs >= PAUSE_HOLD_MS ? { ...p, heldMs: 0, open: true } : { ...p, heldMs };
}

/** Выбор: верный закрывает паузу (на последнем шаге — сбой назван, иначе ждёт следующий шаг), неверный запоминается. */
export function choosePause(p: PauseState, idx: number, correct: number, last = true): PauseState {
  if (!p.open) return p;
  if (idx === correct) return last ? { ...p, open: false, named: true } : { ...p, open: false, tried: [], step: p.step + 1 };
  return p.tried.includes(idx) ? p : { ...p, tried: [...p.tried, idx] };
}

export const holdProgress = (p: PauseState): number => Math.min(1, p.heldMs / PAUSE_HOLD_MS);
