import { useCallback, useState } from 'react';
import { isSecondaryHidden } from '../../../../shared/src/today/todayFocus';

// «Что ещё можно сегодня»: на телефоне потребности, индекс и последние записи
// свёрнуты под ссылкой, как в мини-аппе. Ключ памяти — тот же, что у мини-аппа
// (schema-miniapp/src/sections/today/helpers.ts), чтобы выбор был один на оба
// фронтенда; сверка ключей — todayMore.test.ts.
export const TODAY_MORE_KEY = 'today_more_open';

/** Раскрыт ли блок при заходе: запомнено «раскрыто» либо выключено «прятать второстепенное». */
export function initialMoreOpen(): boolean {
  try {
    return localStorage.getItem(TODAY_MORE_KEY) === '1' || !isSecondaryHidden();
  } catch {
    return false;
  }
}

/** Запоминает выбор; false — память недоступна, выбор живёт до перезагрузки. */
export function writeMoreOpen(open: boolean): boolean {
  try {
    if (open) localStorage.setItem(TODAY_MORE_KEY, '1');
    else localStorage.removeItem(TODAY_MORE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function useTodayMore() {
  const [open, setOpen] = useState(initialMoreOpen);
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writeMoreOpen(next);
      return next;
    });
  }, []);
  return { open, toggle };
}
