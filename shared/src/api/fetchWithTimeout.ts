// Запрос с потолком ожидания. Без него зависшая сеть (webview мессенджера,
// портал Wi-Fi) держит промис вечно: экран входа крутит спиннер без конца, а
// межвкладочный замок refresh не отпускается (аудит 2026-11, E9). Таймаут
// обрывает запрос (AbortError) — для вызывающего это тот же исход, что сбой
// сети: «временная беда», а не «сессия мертва».
export const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } finally {
    clearTimeout(timer);
  }
}
