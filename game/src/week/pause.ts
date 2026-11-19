// ПАУЗА «Недели» — чистая логика: удержание открывает выбор, верный ответ последнего шага закрывает сбой.
// Шагов бывает два («Среда»): назвать — и понять, что нужно; между шагами пауза закрывается и держится заново.
// В «Пятнице» первые удержания срываются сами (slipPlan): навык растёт от повторения, игрок тут не ошибается.

export const PAUSE_HOLD_MS = 700;

export interface PauseState {
  heldMs: number;  // сколько кнопка уже удерживается
  open: boolean;   // мир замер, идёт выбор
  tried: number[]; // неверные названия, которые уже пробовали
  named: boolean;  // пройден последний шаг
  step: number;    // какой шаг выбора сейчас (0 — назвать)
  slips: number;   // сколько удержаний уже сорвалось
  slipMs: number;  // > 0 — мир замер, но пауза сорвётся через столько мс
  spent: boolean;  // пауза только что сорвалась: кнопку нужно отпустить и удержать заново
}

export const newPause = (): PauseState => ({ heldMs: 0, open: false, tried: [], named: false, step: 0, slips: 0, slipMs: 0, spent: false });

/** Кадр удержания: отпустили раньше срока — отсчёт заново; открытый выбор от кнопки уже не зависит.
 *  slipPlan — сколько мс держится каждое из первых удержаний, прежде чем сорваться (держат кнопку или нет). */
export function holdPause(p: PauseState, dtMs: number, held: boolean, slipPlan: number[] = []): PauseState {
  if (p.open || p.named) return p;
  if (p.slipMs > 0) {
    const slipMs = Math.max(0, p.slipMs - dtMs);
    return slipMs > 0 ? { ...p, slipMs } : { ...p, slipMs: 0, slips: p.slips + 1, spent: true };
  }
  if (!held) return p.heldMs === 0 && !p.spent ? p : { ...p, heldMs: 0, spent: false };
  if (p.spent) return p;
  const heldMs = p.heldMs + dtMs;
  if (heldMs < PAUSE_HOLD_MS) return { ...p, heldMs };
  const slip = p.step === 0 ? slipPlan[p.slips] : undefined;
  return slip ? { ...p, heldMs: 0, slipMs: slip } : { ...p, heldMs: 0, open: true };
}

/** Выбор: верный закрывает паузу (на последнем шаге — сбой назван, иначе ждёт следующий шаг), неверный запоминается. */
export function choosePause(p: PauseState, idx: number, correct: number, last = true): PauseState {
  if (!p.open) return p;
  if (idx === correct) return last ? { ...p, open: false, named: true } : { ...p, open: false, tried: [], step: p.step + 1 };
  return p.tried.includes(idx) ? p : { ...p, tried: [...p.tried, idx] };
}

export const holdProgress = (p: PauseState): number => Math.min(1, p.heldMs / PAUSE_HOLD_MS);
/** Мир стоит: открыт выбор или удержание ещё держится перед срывом. */
export const isFrozen = (p: PauseState): boolean => p.open || p.slipMs > 0;
