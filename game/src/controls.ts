// ════════════════════════════════════════════════════════════════════════════
//  Единый ввод: клавиатура (стрелки+ZXC и WASD+JK) + тач-кнопки (DOM-оверлей).
//  Сцены читают состояние через touch.* и свои Key-объекты.
// ════════════════════════════════════════════════════════════════════════════

import { t, type MsgKey } from './i18n';

export const IS_TOUCH =
  (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in window ||
  // iPad Safari по умолчанию работает в desktop-режиме: pointer:fine и нет
  // ontouchstart — IS_TOUCH ложно становился false и тач-кнопки не показывались.
  // Но мультитач есть всегда (maxTouchPoints>0), по нему и ловим планшет.
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

type JustAction = 'jump' | 'hit' | 'avoid' | 'fawn';

class TouchState {
  left = false;
  right = false;
  jumpHeld = false;  // удержание прыжка — для вариативной высоты
  avoidHeld = false; // удержание «избегай» — тап рывок, держишь залипаешь
  private just: Record<JustAction, boolean> = { jump: false, hit: false, avoid: false, fawn: false };

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

// Подписи статичны в HTML по-русски — переводим их на текущий язык один раз при
// инициализации (язык переключается через reload, так что пересборки не нужно).
function localizeTouchUI() {
  const set = (id: string, key: MsgKey) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  };
  set('tbtn-fawn', 'm_surrender');
  set('tbtn-avoid', 'm_avoid');
  set('tbtn-hit', 'm_fight');
  const rotate = document.getElementById('rotate-hint');
  if (rotate) rotate.innerHTML =
    `<div class="phone-icon">📱</div><div>${t('m_rotate_phone')}<br>${t('m_play_in_landscape')}</div>`;
}

export function initTouchControls() {
  const root = document.getElementById('touch-controls');
  if (!root || !IS_TOUCH) return;

  localizeTouchUI();

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
  hold('tbtn-jump', () => { touch.press('jump'); touch.jumpHeld = true; }, () => { touch.jumpHeld = false; });
  // избегай: тап = рывок (press), удержание = залипнуть (avoidHeld)
  hold('tbtn-avoid', () => { touch.press('avoid'); touch.avoidHeld = true; }, () => { touch.avoidHeld = false; });
  tap('tbtn-hit', 'hit');
  tap('tbtn-fawn', 'fawn');
}
