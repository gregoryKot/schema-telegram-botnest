import { useCallback, useState } from 'react';

// «Что ещё можно сегодня»: на телефоне потребности, индекс и последние записи
// свёрнуты под ссылкой, как в мини-аппе (если не выключено в «Настроить
// экран»). Ключ памяти — тот же, что у мини-аппа
// (schema-miniapp/src/sections/today/helpers.ts), чтобы выбор был один на оба
// фронтенда; сверка ключей — todayMore.test.ts.
export const TODAY_MORE_KEY = 'today_more_open';

/** Запомнено ли «раскрыто» на этом устройстве. */
export function readMoreOpen(): boolean {
  try {
    return localStorage.getItem(TODAY_MORE_KEY) === '1';
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

/**
 * secondaryHidden — настройка «Что ещё можно сегодня» под сворачиванием
 * (лист «Настроить экран»). Выключена — блок раскрыт всегда и раскрывашки нет;
 * включена — раскрытие по ссылке, с памятью на устройстве.
 */
export function useTodayMore(secondaryHidden: boolean) {
  const [userOpen, setUserOpen] = useState(readMoreOpen);
  const toggle = useCallback(() => {
    setUserOpen((prev) => {
      const next = !prev;
      writeMoreOpen(next);
      return next;
    });
  }, []);
  return { open: !secondaryHidden || userOpen, collapsible: secondaryHidden, toggle };
}
