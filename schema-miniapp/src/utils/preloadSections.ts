import type { Section } from '../components/BottomNav';
import { SECTION_LOADERS } from './sectionLoaders';

const ALL_SECTIONS: Section[] = ['today', 'schemas', 'help', 'profile'];

/** requestIdleCallback с фолбэком на setTimeout — WebView Telegram/MAX
 * (как и Safari) его не реализует, хотя в типах DOM метод объявлен как
 * гарантированный. 200 мс — не встаём в очередь сразу за первым рендером,
 * но и не тянем резину. */
function onIdle(cb: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(cb);
  } else {
    setTimeout(cb, 200);
  }
}

/**
 * Догружает секции, которые пользователь не открыл первыми, в простое
 * браузера — чтобы переключение вкладок оставалось мгновенным после первого
 * рендера (замер 2026-08-22: без разбиения бандла единый чанк — 1,26 МБ,
 * 2,3 c до первого рендера на 3G; с React.lazy стартовая секция грузится
 * первой, а остальные тремя отдельными витками простоя — не одним
 * Promise.all, чтобы не создать длинную задачу поверх ещё идущего первого
 * рендера текущей секции).
 *
 * Возвращает список запланированных секций — прод-код результат не читает,
 * это только для теста (проверить, что план построен верно, не дожидаясь
 * реальных idle-колбэков).
 */
export function preloadOtherSections(current: Section): Section[] {
  const rest = ALL_SECTIONS.filter((s) => s !== current);
  function loadNext(index: number): void {
    if (index >= rest.length) return;
    onIdle(() => {
      // Фоновая догрузка — ошибку (например офлайн) не показываем: секция
      // просто догрузится обычным путём через React.lazy, когда до неё
      // реально дойдёт переключение вкладки.
      void SECTION_LOADERS[rest[index]]().finally(() => loadNext(index + 1));
    });
  }
  loadNext(0);
  return rest;
}
