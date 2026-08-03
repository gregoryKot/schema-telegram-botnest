// Регистрация service worker'а (docs/PWA_PLAN.md фаза 1). Только web-хост:
// внутри Telegram/MAX мини-апп живёт в вебвью мессенджера — SW там не нужен
// и рискует отдать устаревшую оболочку поверх актуального вебвью хоста
// (docs/MULTI_HOST_PLAN.md шаг 3). Свой модуль, а не сгенерированный
// плагином клиент (`injectRegister: false` в vite.config.ts) — так же можно
// подцепить свой UI обновления (UpdateToast.tsx) через onUpdateAvailable.
import { Workbox } from 'workbox-window';
import { getHost } from '../../shared/src/host';

const SW_URL = '/app/sw.js';
const SCOPE = '/app/';

let workbox: Workbox | null = null;
type UpdateListener = () => void;
let updateListener: UpdateListener | null = null;

export function shouldRegisterServiceWorker(): boolean {
  return (
    getHost().id === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

/** UpdateToast подписывается в useEffect, чтобы узнать про готовое обновление. */
export function onUpdateAvailable(listener: UpdateListener): () => void {
  updateListener = listener;
  return () => {
    if (updateListener === listener) updateListener = null;
  };
}

export function registerServiceWorker(): void {
  if (!shouldRegisterServiceWorker()) return;
  // type НЕ 'module': injectManifest собирает sw.ts в классический бандл
  // (в dist/sw.js нет ни import, ни export), а devOptions выключены — то есть
  // модульного SW у нас не бывает никогда. Попросив 'module', мы заставили бы
  // браузер разбирать классический файл как модуль и отвалились бы там, где
  // модульные SW не поддерживаются, — причём молча, потому что регистрация
  // намеренно гасит ошибку ниже.
  workbox = new Workbox(SW_URL, { scope: SCOPE });
  // 'waiting' — новая версия установлена и ждёт активации (старая ещё
  // контролирует открытые вкладки). Ровно момент показать тост.
  workbox.addEventListener('waiting', () => updateListener?.());
  workbox.register().catch(() => {
    // SW — прогрессивное улучшение, а не критичный путь: тихий отказ
    // (приватный режим, отключённый SW в браузере) не должен ронять аппку.
  });
}

/** Кнопка «Обновить» в тосте: активировать новую версию и перезагрузить вкладку. */
export function applyUpdate(): void {
  if (!workbox) return;
  workbox.addEventListener('controlling', () => window.location.reload());
  workbox.messageSkipWaiting();
}

/** Только для тестов: сбросить состояние модуля между прогонами. */
export function _resetForTests(): void {
  workbox = null;
  updateListener = null;
}
