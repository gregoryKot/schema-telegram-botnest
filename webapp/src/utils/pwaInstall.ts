// Установка PWA из браузера (сайт → приложение /app/, см. манифест у корня).
// Chromium даёт событие beforeinstallprompt — оно стреляет один раз и обычно
// в первые секунды, ДО монтирования React. Поэтому слушатель модульный:
// ловим и держим событие здесь, а компоненты подписываются на уже пойманное.
// Safari/iOS события не даёт вовсе — там показываем шаги руками
// (components/installGuide/installSteps.ts).
import { isStandalone, webPlatform } from '../../../shared/src/host/web';

// Детект «уже открыто как приложение» — единственная реализация в shared
// (правило №3), здесь только ре-экспорт для потребителей установки.
export { isStandalone };

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

/** Платформа для выбора шагов инструкции — на базе UA-парсера shared-хоста. */
export function detectInstallPlatform(
  ua?: string,
  maxTouchPoints?: number,
): InstallPlatform {
  const p = webPlatform(ua, maxTouchPoints);
  return p === 'ios' || p === 'android' ? p : 'desktop';
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach((l) => l());

function onBeforeInstallPrompt(e: Event): void {
  // Без preventDefault Chrome покажет свой мини-бар и «сожжёт» событие.
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  notify();
}

// Установили мимо нашей кнопки (меню браузера, значок в омнибоксе) —
// пойманный промпт протух: Chromium отклонит prompt() на нём, а кнопка
// «Установить» для уже установленного приложения — враньё. Сбрасываем.
function onAppInstalled(): void {
  deferred = null;
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
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
  notify();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice.outcome;
  } catch {
    // Протухшее событие (браузер успел установить/запретить) — для
    // пользователя это «диалога не будет», остаются шаги руками рядом.
    return 'unavailable';
  }
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
