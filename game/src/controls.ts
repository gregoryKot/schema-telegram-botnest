// ════════════════════════════════════════════════════════════════════════════
//  Единый ввод: клавиатура (стрелки+ZXC и WASD+JK) + тач-кнопки (DOM-оверлей).
//  Сцены читают состояние через touch.* и свои Key-объекты.
// ════════════════════════════════════════════════════════════════════════════

export const IS_TOUCH =
  (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in window ||
  // iPad Safari по умолчанию работает в desktop-режиме: pointer:fine и нет
  // ontouchstart — IS_TOUCH ложно становился false и тач-кнопки не показывались.
  // Но мультитач есть всегда (maxTouchPoints>0), по нему и ловим планшет.
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

type JustAction = 'jump' | 'hit' | 'dash' | 'fawn';

class TouchState {
  left = false;
  right = false;
  freeze = false;
  private just: Record<JustAction, boolean> = { jump: false, hit: false, dash: false, fawn: false };

  press(a: JustAction) { this.just[a] = true; }
  /** just-pressed: вернёт true один раз на нажатие */
  consume(a: JustAction): boolean {
    const v = this.just[a];
    this.just[a] = false;
    return v;
  }
}

export const touch = new TouchState();

// Тач-кнопки нужны только в геймплее (Game/Tutorial). На титуле и в катсценах
// они перекрывали кнопку «НАЧАТЬ» и сбивали тапы — поэтому показываем точечно.
export function setTouchControls(visible: boolean) {
  const root = document.getElementById('touch-controls');
  if (!root || !IS_TOUCH) return;
  root.classList.toggle('visible', visible);
}

export function initTouchControls() {
  const root = document.getElementById('touch-controls');
  if (!root || !IS_TOUCH) return;

  const hold = (id: string, on: () => void, off: () => void) => {
    const el = document.getElementById(id)!;
    let pid: number | null = null;
    // setPointerCapture: палец, начавший на кнопке, гарантированно получит
    // pointerup на ней же, даже если соскользнул на соседнюю — иначе
    // «удержание» (ОТВЛЕКИСЬ) залипало и игра казалась зависшей.
    const down = (e: PointerEvent) => {
      e.preventDefault();
      pid = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* not supported — ok */ }
      el.classList.add('pressed'); on();
    };
    const up = (e: PointerEvent) => {
      if (pid !== null && e.pointerId !== pid) return; // чужой палец (мультитач) — не трогаем
      pid = null;
      el.classList.remove('pressed'); off();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const tap = (id: string, a: JustAction) => hold(id, () => touch.press(a), () => undefined);

  hold('tbtn-left',  () => { touch.left = true; },  () => { touch.left = false; });
  hold('tbtn-right', () => { touch.right = true; }, () => { touch.right = false; });
  hold('tbtn-freeze', () => { touch.freeze = true; }, () => { touch.freeze = false; });
  tap('tbtn-jump', 'jump');
  tap('tbtn-hit', 'hit');
  tap('tbtn-dash', 'dash');
  tap('tbtn-fawn', 'fawn');
}
