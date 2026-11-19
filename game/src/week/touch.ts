// Тач-кнопки «Недели» поверх общих (controls.ts): свои подписи, сетка 2×2 (.week в index.html),
// кнопка открывается, когда сюжет до неё дошёл. Четвёртая — ПАУЗА — живёт только здесь.
import { IS_TOUCH, hold, localizeTouchUI, setTouchControls } from '../controls';
import type { Act } from './monday';

const BTN: Record<Act, string> = { overwork: 'tbtn-hit', scroll: 'tbtn-avoid', agree: 'tbtn-fawn', pause: 'tbtn-pause' };
const ACTS = Object.keys(BTN) as Act[];
const el = (act: Act) => document.getElementById(BTN[act]);
const root = () => (IS_TOUCH ? document.getElementById('touch-controls') : null);

let pauseHeld = false, wired = false;
export const weekTouch = { get pauseHeld() { return pauseHeld; } };

/** Раскладка «Недели»; кнопки покажет старт после заставки. holdHint — подпись под ПАУЗОЙ. */
export function enterWeekTouch(labels: Record<Act, string>, holdHint: string) {
  const r = root();
  if (!r) return;
  r.classList.add('week');
  for (const act of ACTS) {
    const b = el(act);
    if (!b) continue;
    b.textContent = labels[act];
    if (act === 'pause') { const sub = document.createElement('small'); sub.textContent = holdHint; b.append(sub); }
    b.classList.remove('long');
    b.style.visibility = 'hidden'; // место в сетке держит: кнопки не прыгают, когда открывается следующая
  }
  if (!wired) { wired = true; hold(BTN.pause, () => { pauseHeld = true; }, () => { pauseHeld = false; }); }
  setTouchControls(false);
}

export function revealWeekAct(act: Act) {
  const b = root() && el(act);
  if (b) b.style.visibility = 'visible';
}

/** Подсказка: кнопка мигает, пока её не нажмут (класс .call в index.html). */
export function callWeekAct(a: Act | 'jump', on: boolean) {
  const b = root() && (a === 'jump' ? document.getElementById('tbtn-jump') : el(a));
  b?.classList.toggle('call', on);
}

/** Уход из «Недели» (меню → старая игра): прежние подписи и раскладка. */
export function leaveWeekTouch() {
  const r = root();
  if (!r) return;
  r.classList.remove('week');
  for (const act of ACTS) { const b = el(act); if (b) b.style.visibility = ''; }
  for (const b of r.querySelectorAll('.call')) b.classList.remove('call');
  pauseHeld = false;
  localizeTouchUI();
}
