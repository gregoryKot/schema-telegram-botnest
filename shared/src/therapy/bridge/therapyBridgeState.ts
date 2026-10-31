// Локальное состояние моста к терапевту: «Не сейчас» и след кризисного текста.
// Хранится только на устройстве, без синка (сознательно: не трогаем uiPrefsSync
// и мини-апп). Каждое обращение к localStorage — в try/catch: приватный режим и
// заблокированные данные сайта не должны ронять экран.
const DISMISSED_KEY = 'therapy_nudge_dismissed_until';
const CRISIS_KEY = 'therapy_crisis_seen_at';
const DISMISS_DAYS = 14;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** false — хранилище недоступно: карточка просто покажется снова, экран не падает. */
function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** ISO-момент, до которого карточка по сигналу скрыта; null — не скрыта. */
export function getDismissedUntil(): string | null {
  return read(DISMISSED_KEY);
}

/** «Не сейчас»: прячем карточку на 14 дней. */
export function dismissFor14Days(now: Date = new Date()): void {
  const until = new Date(now.getTime() + DISMISS_DAYS * 24 * 60 * 60 * 1000);
  write(DISMISSED_KEY, until.toISOString());
}

/** Пользователь написал кризисный текст: запоминаем момент (поднимает сигнал на 7 дней). */
export function noteCrisisSeen(now: Date = new Date()): void {
  write(CRISIS_KEY, now.toISOString());
}

export function getCrisisSeenAt(): string | null {
  return read(CRISIS_KEY);
}
