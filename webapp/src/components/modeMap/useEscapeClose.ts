import { useEffect } from 'react';

// Escape закрывает всплывающее меню холста и не доходит до useMapKeys (выбор узла остаётся);
// capture — раньше слушателей холста при любом порядке подписки, как у Dropdown.
export function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
}
