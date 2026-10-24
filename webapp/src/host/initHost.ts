import { getHost } from '../../../shared/src/host';

// Когда перечитывать хост, если на старте он ещё не определился:
// telegram-web-app.js в index.html грузится асинхронно, и модуль приложения
// может выполниться раньше SDK. Те же задержки — у useSafeTop в shared.
export const LATE_HOST_READS_MS = [150, 500, 1500, 3000];

let done = false;
/** Только для тестов. */
export const _resetInitHostForTests = () => {
  done = false;
};

/**
 * Один раз за жизнь вкладки сообщает мессенджеру «приложение готово» и просит
 * развернуть его на весь экран (как мини-апп в App.tsx). В браузере ничего не
 * делает. Возвращает отмену отложенных перечитываний (для тестов).
 */
export function initHost(): () => void {
  const run = () => {
    if (done) return;
    const host = getHost();
    if (host.id === 'web') return;
    done = true;
    host.ready();
    host.expand();
  };
  run();
  if (done) return () => {};
  const timers = LATE_HOST_READS_MS.map((ms) => setTimeout(run, ms));
  return () => timers.forEach(clearTimeout);
}
