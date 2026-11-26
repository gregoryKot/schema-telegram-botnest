// Устаревший чанк после деплоя: открытая вкладка держит старый index, а файлы
// ленивых разделов уже заменены новыми. Лечится одной перезагрузкой страницы.
// Текст ошибки у каждого движка свой — до инцидента 2026-10-19 проверка знала
// только Chrome, и на iPhone (Safari: «Importing a module script failed.»)
// вместо тихой перезагрузки человек видел «Раздел упал» со стеком.

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|Unable to preload CSS/i;

export function isChunkLoadError(message: string | undefined | null): boolean {
  return !!message && CHUNK_ERROR_RE.test(message);
}

const RELOAD_KEY = 'chunk-reload-at';
/** Не чаще раза в минуту: если и свежая версия не грузится, не уходим в цикл. */
const RELOAD_COOLDOWN_MS = 60_000;

/** Перезагружает страницу, если в последнюю минуту этого ещё не делали. */
export function reloadForFreshChunks(now = Date.now()): boolean {
  const last = readLastReload();
  if (last === null || now - last < RELOAD_COOLDOWN_MS) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Время прошлой перезагрузки; null — память недоступна (без неё цикл не остановить). */
function readLastReload(): number | null {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    return null;
  }
}

/**
 * Vite сам сообщает о сбое предзагрузки ленивого модуля событием
 * `vite:preloadError` — ещё до того, как ошибка дойдёт до ErrorBoundary.
 * Перезагрузились — гасим событие, иначе import() бросит дальше.
 */
export function installChunkReloadListener(target: Window = window): void {
  target.addEventListener('vite:preloadError', (event) => {
    if (reloadForFreshChunks()) event.preventDefault();
  });
}
