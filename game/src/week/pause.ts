// ПАУЗА «Недели» — чистая логика: удержание открывает выбор названия, верное название закрывает сбой.

export const PAUSE_HOLD_MS = 700;

export interface PauseState {
  heldMs: number;  // сколько кнопка уже удерживается
  open: boolean;   // мир замер, идёт выбор
  tried: number[]; // неверные названия, которые уже пробовали
  named: boolean;  // выбрано верное
}

export const newPause = (): PauseState => ({ heldMs: 0, open: false, tried: [], named: false });

/** Кадр удержания: отпустили раньше срока — отсчёт заново; открытый выбор от кнопки уже не зависит. */
export function holdPause(p: PauseState, dtMs: number, held: boolean): PauseState {
  if (p.open || p.named) return p;
  if (!held) return p.heldMs === 0 ? p : { ...p, heldMs: 0 };
  const heldMs = p.heldMs + dtMs;
  return heldMs >= PAUSE_HOLD_MS ? { ...p, heldMs: 0, open: true } : { ...p, heldMs };
}

/** Выбор названия: верное закрывает паузу, неверное запоминается — выбор остаётся. */
export function choosePause(p: PauseState, idx: number, correct: number): PauseState {
  if (!p.open) return p;
  if (idx === correct) return { ...p, open: false, named: true };
  return p.tried.includes(idx) ? p : { ...p, tried: [...p.tried, idx] };
}

export const holdProgress = (p: PauseState): number => Math.min(1, p.heldMs / PAUSE_HOLD_MS);
