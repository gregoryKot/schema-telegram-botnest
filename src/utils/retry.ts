/**
 * Ретрай с линейным бэкоффом для транзиентных сбоев (сеть на старте
 * контейнера и т.п.). Возвращает true при успехе, false если все попытки
 * исчерпаны или пришёл `signal` — решать, алертить ли, остаётся вызывающему.
 * `signal` гасит ожидание сразу: ретраи, начатые в onModuleInit, не держат
 * процесс после app.close() (e2e не выходили сразу после тестов, 2026-11-08).
 */
export async function retryWithBackoff(
  fn: () => Promise<unknown>,
  opts: { attempts?: number; baseDelayMs?: number; signal?: AbortSignal } = {},
): Promise<boolean> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 5_000;
  const { signal } = opts;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) return false;
    try {
      await fn();
      return true;
    } catch {
      if (attempt === attempts) return false;
      await pause(attempt * base, signal);
    }
  }
  return false;
}

/** Пауза, которую обрывает signal: таймер снимается, промис резолвится. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}
