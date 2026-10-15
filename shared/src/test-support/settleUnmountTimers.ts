// Общий кусок rtlCleanup.ts всех трёх фронтовых пакетов. Сам rtlCleanup не
// общий: у каждого пакета свой экземпляр RTL (см. его шапку).

// Настоящий setTimeout, запомненный при загрузке setup-файла — раньше любого
// теста. Тест может подделать таймеры (vi.useFakeTimers) или подменить
// setTimeout через vi.stubGlobal и забыть вернуть: ожидание на запомненном
// таймере от этого не зависит и не виснет.
const realSetTimeout = globalThis.setTimeout;

/**
 * Даёт сработать коротким таймерам, которые компонент ставит при
 * размонтировании (tiptap: `scheduleDestroy` через `setTimeout(…, 1)`), пока
 * jsdom ещё жив: таймер на 1 мс истекает раньше нашего на `ms`.
 *
 * Граница честная: гарантированно успевают таймеры не длиннее `ms`,
 * поставленные до afterAll. Более длинный зависит от того, как быстро
 * завершится воркер. Таймер на секунды (тост `setTimeout(() => setX(false), N)`
 * без clearTimeout) так не закрыть — его чистят в самом коде
 * (`shared/src/hooks/useTimedFlag.ts`).
 */
export function settleUnmountTimers(ms = 10): Promise<void> {
  return new Promise((resolve) => realSetTimeout(resolve, ms));
}
