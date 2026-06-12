// ════════════════════════════════════════════════════════════════════════════
//  Единый ввод: клавиатура (стрелки+ZXC и WASD+JK) + тач-кнопки (DOM-оверлей).
//  Сцены читают состояние через touch.* и свои Key-объекты.
// ════════════════════════════════════════════════════════════════════════════

export const IS_TOUCH =
  (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in window;

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

export function initTouchControls() {
  const root = document.getElementById('touch-controls');
  if (!root || !IS_TOUCH) return;
  root.classList.add('visible');

  const hold = (id: string, on: () => void, off: () => void) => {
    const el = document.getElementById(id)!;
    const down = (e: Event) => { e.preventDefault(); el.classList.add('pressed'); on(); };
    const up = () => { el.classList.remove('pressed'); off(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
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
