// После сна устройства/разрыва сети сессия раньше не чинилась сама — ни
// одного слушателя online/visibilitychange не было ни у мини-аппа, ни у сайта
// (диагностика «постоянно нужно логиниться заново», 2026-08-21, пункт 3).
// Возврат связи/фокуса — сигнал попробовать перевыпуск сразу, а не ждать
// следующего 401 в середине действия пользователя. Вынесено из session.ts —
// файл-храповик (правило №10 CLAUDE.md), новую логику некуда дописывать.
export interface SessionRetryHooks {
  renewSession: () => Promise<boolean>;
  /** Снять кулдаун ретраев, если последняя неудача была временной (не
   *  сессия-точно-мертва) — иначе ждать полные 30с после уже случившегося
   *  сигнала «сеть вернулась» бессмысленно. */
  clearTransientCooldown: () => void;
}

/** `typeof window` — щит для тестовых файлов, где модуль, вызывающий это,
 *  импортируется в node-окружении без DOM. */
export function registerSessionRetryListeners(hooks: SessionRetryHooks): void {
  if (typeof window === 'undefined') return;
  const retryNow = () => {
    hooks.clearTransientCooldown();
    void hooks.renewSession();
  };
  window.addEventListener('online', retryNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retryNow();
  });
}
