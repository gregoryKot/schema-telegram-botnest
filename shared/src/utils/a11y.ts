// Клавиатурная активация не-кнопочных интерактивных элементов (a11y-храповик,
// 2026-07, правило №9 CLAUDE.md + best-practice a11y). div/span, которым нельзя
// быть нативным <button> из-за вёрстки (карточки, строки, плитки), получают
// role="button" + tabIndex + Enter/Space одним спредом: `{...pressable(fn)}`.
//
// Правило «одна механика — один компонент»: единая точка вместо копипасты
// role/tabIndex/onKeyDown по десяткам мест. Правишь поведение клавиатуры —
// правишь здесь, а не в 80 файлах.
//
// Когда НЕ применять: элемент уже нативно интерактивен (<button>, <a>);
// это оверлей-подложка для закрытия (там своя кнопка «Закрыть» с aria-label);
// обработчику нужен сам event (stopPropagation) — тогда добавляй role/tabIndex/
// onKeyDown вручную.
import type { KeyboardEvent } from 'react';

export interface PressableProps {
  role: 'button';
  tabIndex: 0;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

// Инцидент 2026-08 (карточка режима): внутри pressable-карточки жил
// <textarea>, и его нажатия всплывали в onKeyDown обёртки — пробел уходил в
// preventDefault(), пользователь физически не мог поставить пробел в тексте.
// Клавиша, набранная в поле ввода (или в своей кнопке/ссылке внутри), к
// обёртке не относится: не перехватываем.
const NESTED_CONTROL = /^(input|textarea|select|button|a)$/;

function typedInNestedControl(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target || target === e.currentTarget) return false;
  const tag = target.tagName?.toLowerCase() ?? '';
  return NESTED_CONTROL.test(tag) || Boolean(target.isContentEditable);
}

export function pressable(handler: () => unknown): PressableProps {
  // handler: () => unknown — принимает любой возврат: sync, async
  // (`() => openClient(c)`) и короткие `() => cond && doX()` (`false | void`).
  // void-обёртка гасит результат: onClick/onKeyDown обязаны возвращать void,
  // иначе no-misused-promises на спреде `{...pressable(...)}`. Поведение для
  // sync-хендлеров не меняется; ошибки ловят сами обработчики.
  const run = () => {
    void handler();
  };
  return {
    role: 'button',
    tabIndex: 0,
    onClick: run,
    onKeyDown: (e: KeyboardEvent) => {
      if (typedInNestedControl(e)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        run();
      }
    },
  };
}
