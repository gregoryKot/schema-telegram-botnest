// Service worker мини-аппа (docs/PWA_PLAN.md фаза 1, scope /app/ — не может
// тронуть сайт, /api или OAuth-коллбэки, см. docs/MULTI_HOST_PLAN.md шаг 3).
//
// Пишем без "webworker" lib: проектный tsconfig.json общий с DOM-кодом
// приложения, и DOM+WebWorker lib конфликтуют в одной программе (оба
// объявляют глобальный `self` по-разному). Модульная область файла (есть
// `import`) позволяет локально переобъявить `self` под воркер-контекст —
// объявляем только то, чем реально пользуемся.
import { precacheAndRoute } from 'workbox-precaching';

declare const self: {
  /** Список файлов сборки — подставляет vite-plugin-pwa (injectManifest). */
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
  addEventListener: (
    type: 'message',
    listener: (event: { data?: { type?: string } | null }) => void,
  ) => void;
  skipWaiting: () => void;
};

// Прекэш — только оболочка мини-аппа (html/js/css из сборки, см.
// injectManifest.globPatterns в vite.config.ts). /api/* сюда попасть не
// может физически: self.__WB_MANIFEST строится из билд-ассетов, никакой
// раздачи данных пользователя SW не видит и не решает — это NetworkOnly по
// умолчанию (SW просто не регистрирует для /api ни одного route/handler).
precacheAndRoute(self.__WB_MANIFEST);

// Сигнал от кнопки «Обновить» в тосте (registerServiceWorker.ts, через
// workbox-window messageSkipWaiting()) — активировать новую версию сразу,
// а не ждать закрытия всех вкладок.
// `data` бывает и пустой (в воркер может постучаться кто угодно) — без ?.
// обработчик падал бы на постороннем сообщении.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Push-handler (событие 'push' → showNotification, 'notificationclick' →
// фокус/открытие раздела) приедет в фазе 4 PWA_PLAN.md — сюда, в этот файл.
