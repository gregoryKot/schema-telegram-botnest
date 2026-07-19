// ── Shared helpers ────────────────────────────────────────────────────────────

// Прогрессивное раскрытие (нейроинклюзивность, волна 1): вторичные карточки
// свёрнуты по умолчанию, выбор запоминается на устройстве.
export const TODAY_MORE_KEY = 'today_more_open';

export function hexToRgb(hex: string): string {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
}

export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const m10 = n % 10,
    m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

export function formatGreetingDate(): string {
  const now = new Date();
  const dow = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  return `${dow}, ${date}`;
}

export function readLocalIds(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}
