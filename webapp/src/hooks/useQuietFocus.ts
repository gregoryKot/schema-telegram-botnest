// «Тихое» кольцо фокуса у окна и листа, открытых не с клавиатуры (Dialog, WhySheet — одна механика).
// useDialogA11y ставит фокус на первую кнопку, а Chrome показывает :focus-visible и у программного
// фокуса, если человек ещё ничего не нажимал (окно открылось само) — первая кнопка выглядела выбранной.
// Открыто не с клавиатуры — контейнер «тихий» (data-focus="quiet", index.css): кольца нет до первой
// клавиши перехода внутри. Чем открыли — последний ввод на странице (клавиша или касание).
import { useState, type KeyboardEvent } from 'react';

/** Последний ввод на странице — клавиатура? Слушатели ставятся один раз, при загрузке модуля. */
let lastInputKeyboard = false;
let tracking = false;
function trackInputModality() {
  if (tracking || typeof document === 'undefined') return;
  tracking = true;
  document.addEventListener('keydown', (e) => { if (!e.metaKey && !e.ctrlKey && !e.altKey) lastInputKeyboard = true; }, true);
  document.addEventListener('pointerdown', () => { lastInputKeyboard = false; }, true);
}
trackInputModality();

/** Клавиши, которыми ходят по окну: после них кольцо нужно и в «тихом» окне. */
const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export interface QuietFocusProps {
  'data-focus'?: 'quiet';
  onKeyDown?: (e: KeyboardEvent) => void;
}

/** Пропсы контейнера окна: «тихий», пока последний ввод не с клавиатуры, до первой клавиши перехода. */
export function useQuietFocus(): QuietFocusProps {
  const [quiet, setQuiet] = useState(() => !lastInputKeyboard);
  if (!quiet) return {};
  return { 'data-focus': 'quiet', onKeyDown: (e) => { if (NAV_KEYS.has(e.key)) setQuiet(false); } };
}
