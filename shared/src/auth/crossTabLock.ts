// Сериализация refresh-запросов между вкладками/инстансами одного origin —
// правило №3 CLAUDE.md, оба фронтенда. Без неё два параллельных запроса
// (вкладка сайта открыта дважды, или вкладка сайта + установленное
// PWA-приложение мини-аппа — один origin, одна refresh-кука) — это две
// одновременные ротации ОДНОГО refresh-токена. Сервер видит в этом кражу и
// отзывает всю семью — пользователь разлогинивается на всех устройствах
// разом (диагностика «постоянно нужно логиниться заново», 2026-08-21).
//
// In-tab замок (общий промис в session.ts/AuthProvider.tsx) закрывает гонку
// внутри одной вкладки, но не между вкладками — у них разные JS-контексты.
// Web Locks API даёт межвкладочную блокировку без похода на сервер.
interface LocksLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

function getLocks(): LocksLike | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as Navigator & { locks?: LocksLike }).locks;
  return locks ?? null;
}

/**
 * Выполняет `fn` под именованной межвкладочной блокировкой, если Web Locks
 * API доступен (поддержка не повсеместна — Safari < 15.4, небезопасный
 * контекст). Иначе выполняет `fn` напрямую: единственной защитой остаётся
 * in-tab-замок вызывающей стороны, что не хуже поведения до этого фикса.
 */
export function withCrossTabLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const locks = getLocks();
  return locks ? locks.request(name, fn) : fn();
}
