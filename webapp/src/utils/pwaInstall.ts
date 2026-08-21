// Установка PWA из браузера (сайт → приложение /app/, см. манифест у корня).
// Chromium даёт событие beforeinstallprompt — оно стреляет один раз и обычно
// в первые секунды, ДО монтирования React. Поэтому слушатель модульный:
// ловим и держим событие здесь, а компоненты подписываются на уже пойманное.
// Safari/iOS события не даёт вовсе — там показываем шаги руками
// (components/installGuide/installSteps.ts).

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

/** Чистая функция: платформа по user agent (для выбора шагов инструкции). */
export function detectInstallPlatform(
  ua: string = navigator.userAgent,
  maxTouchPoints: number = navigator.maxTouchPoints ?? 0,
): InstallPlatform {
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS 13+ прикидывается маком — отличаем по мультитачу.
  if (/macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Страница уже открыта как установленное приложение — предлагать нечего. */
export function isStandalone(): boolean {
  // typeof-проверка вместо try/catch: у jsdom в тестах matchMedia нет вовсе.
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return true;
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function onBeforeInstallPrompt(e: Event): void {
  // Без preventDefault Chrome покажет свой мини-бар и «сожжёт» событие.
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
}

/** Снимок для useSyncExternalStore: пойман ли нативный промпт установки. */
export function hasInstallPrompt(): boolean {
  return deferred !== null;
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Показать нативный диалог установки. Событие одноразовое — после показа
 *  кнопка исчезает (повторный промпт браузер всё равно не даст). */
export async function promptInstall(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  listeners.forEach((l) => l());
  await e.prompt();
  const choice = await e.userChoice;
  return choice.outcome;
}

/** Браузер сообщил, что приложение установлено (Chromium, событие appinstalled). */
export function subscribeAppInstalled(cb: () => void): () => void {
  window.addEventListener('appinstalled', cb);
  return () => window.removeEventListener('appinstalled', cb);
}

/** Только для тестов: сброс модульного состояния между кейсами. */
export function _resetInstallPromptForTests(): void {
  deferred = null;
  listeners.clear();
}
