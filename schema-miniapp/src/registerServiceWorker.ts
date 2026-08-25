// ЭКСПЕРИМЕНТ 2026-08-25: service worker в PWA ВЫКЛЮЧЕН — вместо регистрации
// снимаем уже установленный и чистим его кеши.
//
// Разбор недельной жалобы «из ярлыка первую минуту ужасно, в Telegram
// летает, перезапуск всё сбрасывает»: единственная структурная разница
// между площадками — сам SW (в вебвью мессенджеров он не регистрировался
// никогда, см. shouldRegisterServiceWorker). Феномен «standalone PWA заметно
// медленнее того же сайта в Safari» документирован (Apple DevForums, тред
// 714477) — разработчики лечили его переписыванием SW, а очистка данных
// сайта помогала временно. Механика, совпадающая с симптомом кадр в кадр:
// скрипты, отданные из Cache Storage сервис-воркером, не получают кеш
// байткода (v8.dev/blog/code-caching-for-devs; для WebKit не документировано,
// но поведение сходится) — весь JS (~1.2МБ) перепарсируется и
// перекомпилируется на КАЖДОМ холодном старте, JIT прогревается заново.
// Отсюда ужасная первая минута, которая «чинится» прогревом и возвращается
// после перезапуска. Плюс после каждого деплоя SW перекачивал весь прекеш.
//
// Без SW статика PWA едет ровно тем же путём, что в Telegram: HTTP-кеш +
// ETag/304 (src/infra/static-cache.ts) — с обычным кешем байткода браузера.
// Цена эксперимента: (1) нет офлайн-оболочки — данные и так требуют сети,
// офлайн-очередь оценок (outbox) живёт отдельно и не зависит от SW;
// (2) нет тоста «Обновить» — обновления приезжают обычной перезагрузкой,
// что при no-cache на index НАДЁЖНЕЕ прежнего двойного перезапуска.
// Подтвердится у владельца — зафиксируем насовсем и выпилим UpdateToast;
// нет — вернём SW с прекешем только оболочки (без JS).
import { getHost } from '../../shared/src/host';

type UpdateListener = () => void;
let updateListener: UpdateListener | null = null;

export function shouldRegisterServiceWorker(): boolean {
  return (
    getHost().id === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

/** UpdateToast подписывается на «готово обновление». Пока SW выключен,
 *  событие не наступает никогда — подписка остаётся ради обратной
 *  совместимости и лёгкого отката эксперимента. */
export function onUpdateAvailable(listener: UpdateListener): () => void {
  updateListener = listener;
  return () => {
    if (updateListener === listener) updateListener = null;
  };
}

/** Снимает установленный ранее SW и чистит его кеши (см. шапку файла).
 *  Имя сохранено: main.tsx зовёт её по расписанию, как звал регистрацию. */
export function registerServiceWorker(): void {
  if (!shouldRegisterServiceWorker()) return;
  navigator.serviceWorker
    .getRegistrations()
    .then(async (regs) => {
      for (const reg of regs) await reg.unregister();
      // Кеши чистим только если SW реально стоял: у чистого браузера нечего
      // трогать. Текущая страница, пока её ещё контролирует старый SW,
      // переживает чистку: workbox-прекеш при промахе падает в сеть
      // (fallbackToNetwork), а со следующего запуска SW уже нет.
      if (regs.length > 0 && 'caches' in window) {
        for (const key of await caches.keys()) await caches.delete(key);
      }
    })
    .catch((e) => console.error('sw cleanup failed', e));
}

/** Кнопка «Обновить» в тосте: без SW достаточно перезагрузки. */
export function applyUpdate(): void {
  window.location.reload();
}

/** Только для тестов: сбросить состояние модуля между прогонами. */
export function _resetForTests(): void {
  updateListener = null;
}
