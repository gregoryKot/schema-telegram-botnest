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

export function pressable(handler: () => void): PressableProps {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: handler,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    },
  };
}
