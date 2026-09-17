import { useEffect, useRef } from 'react';

// Диалоговая семантика модалок (К4 дизайн-аудита 2026-08): ни один из ~70
// шитов не был размечен как диалог для скринридера — `role="dialog"` не
// хватало нигде, фокус после открытия оставался на кнопке под шитом, Tab
// уходил на фон, закрытие не возвращало фокус туда, откуда открыли. Один хук
// в базовом BottomSheet чинит все 31 места разом (правило «одна механика —
// один компонент»).
//
// Что делает при монтировании:
// 1. запоминает activeElement (куда вернуть фокус при закрытии);
// 2. переносит фокус внутрь диалога — на первый фокусируемый элемент,
//    иначе на сам контейнер (tabIndex=-1 делает его программно фокусируемым);
// 3. держит Tab/Shift+Tab внутри контейнера (фокус-трап) — не даёт уйти на
//    фон под шитом.
// При размонтировании возвращает фокус туда, где он был.
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

export function useDialogA11y(): DialogA11yProps {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Захват в отдельный const с точным типом (не `HTMLElement | null`):
    // вложенная функция ниже не наследует TS-сужение от внешнего `if`, а
    // повторная рантайм-проверка внутри trapTab была бы недостижимой веткой
    // (container — это ref.current на момент эффекта, не читается заново) —
    // без пользы для рантайма, но с недостижимой веткой для coverage-храповика.
    const container: HTMLElement = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const first = focusableIn(container)[0];
    (first ?? container).focus();

    function trapTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
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
      // Диалог мог закрыться из-за размонтирования всего дерева (переход
      // экрана) — элемент, куда возвращаем фокус, может уже быть не в DOM.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return { ref, role: 'dialog', 'aria-modal': true, tabIndex: -1 };
}
