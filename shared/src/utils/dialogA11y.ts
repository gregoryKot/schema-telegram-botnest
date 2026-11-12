import { useEffect, useLayoutEffect, useRef } from 'react';
import { useDialogLayer, type LayerOpts } from './dialogStack';

// Диалоговая семантика модалок (К4 дизайн-аудита 2026-08): один хук в
// базовом шите чинит все места разом. При монтировании запоминает
// activeElement, переносит фокус внутрь (на первый фокусируемый элемент,
// иначе на контейнер), держит Tab внутри (трап), при размонтировании
// возвращает фокус. Трап и Escape — только у верхнего (стек dialogStack.ts): onEscape —
// закрыть, holdEscape — держать, ни того ни другого — Escape слою ниже (лист под трапом).
export interface DialogA11yProps {
  ref: React.RefObject<HTMLDivElement | null>;
  role: 'dialog';
  'aria-modal': true;
  tabIndex: -1;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute('disabled'));
}

export function useDialogA11y(opts: LayerOpts = {}): DialogA11yProps {
  const ref = useRef<HTMLDivElement>(null);
  const layer = useDialogLayer(opts);

  // Слой снимается в layout-фазе, вместе с DOM: пассивная очистка отстаёт от коммита, и снятое
  // с экрана несворачиваемое окно ещё держало Escape — лист под ним его не получал.
  useLayoutEffect(() => layer.join(), [layer]);

  useEffect(() => {
    if (!ref.current) return;
    // Отдельный const с точным типом: TS не переносит сужение во вложенную
    // функцию, а повторная проверка внутри trapTab была бы недостижимой веткой.
    const container: HTMLElement = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Запасная цель возврата фокуса: слой, внутри которого открыто это окно.
    const parentLayer = container.parentElement?.closest<HTMLElement>('[role="dialog"]');

    const first = focusableIn(container)[0];
    (first ?? container).focus();

    function trapTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !layer.isTop()) return;
      const items = focusableIn(container);
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && container.contains(active);
      if (e.shiftKey) {
        if (!inside || active === firstItem) {
          e.preventDefault();
          lastItem.focus();
        }
      } else if (!inside || active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener('keydown', trapTab);

    return () => {
      document.removeEventListener('keydown', trapTab);
      // Элемент, куда возвращаем фокус, мог уйти из DOM вместе с окном (действие убрало свою
      // кнопку) — тогда фокус остаётся в слое-родителе, а не падает на body.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else if (parentLayer?.isConnected) parentLayer.focus();
    };
  }, [layer]);

  return { ref, role: 'dialog', 'aria-modal': true, tabIndex: -1 };
}
