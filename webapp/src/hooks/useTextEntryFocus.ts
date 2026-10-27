import { useSyncExternalStore } from 'react';

// «Человек сейчас печатает»: фокус в текстовом поле на устройстве с касанием.
// Пока это так, на телефоне открыта экранная клавиатура, и плавающие панели
// (нижняя навигация, «+») не должны висеть над ней и закрывать поле.
// Один слушатель на документ на всех подписчиков (MobileNav).

const NOT_TEXT = new Set([
  'checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image', 'hidden',
]);

/** Поле, при фокусе в котором открывается клавиатура (select и кнопки — нет). */
export function isTextEntry(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return !NOT_TEXT.has(el.type) && !el.readOnly && !el.disabled;
  return el instanceof HTMLElement && el.isContentEditable === true;
}

const isTouchDevice = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

let typing = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === typing) return;
  typing = next;
  listeners.forEach((l) => l());
}
const onFocusIn = (e: FocusEvent) => set(isTouchDevice() && isTextEntry(e.target));
// relatedTarget — куда уходит фокус: из поля в поле клавиатура не закрывается.
const onFocusOut = (e: FocusEvent) => set(isTouchDevice() && isTextEntry(e.relatedTarget));

function subscribe(cb: () => void) {
  if (listeners.size === 0) {
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      typing = false;
    }
  };
}

export function useTextEntryFocus(): boolean {
  return useSyncExternalStore(subscribe, () => typing, () => false);
}
