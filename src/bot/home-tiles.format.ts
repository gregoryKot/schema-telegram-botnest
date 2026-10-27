// Строка «Главная: плитки» для /stats (правило №8): нажатия плиток и ссылок
// главной сайта за месяц. Чистый форматтер; язык — словами, без id.

// Подписи плиток главной — словами, без id. Порядок — как на экране.
export const HOME_TILE_LABELS: Record<string, string> = {
  tracker: 'Трекер',
  case: 'Что случилось',
  diary: 'Дневник',
  calm: 'Подышать',
  why: 'Зачем это',
  feed_all: 'Все записи',
};

/** Строка «Главная: плитки — …» или null, пока на плитки не нажимали. */
export function formatHomeTiles(
  rows: Array<{ tile: string; count: number }>,
): string | null {
  const counts = new Map(rows.map((r) => [r.tile, r.count]));
  const parts = Object.keys(HOME_TILE_LABELS)
    .map((tile) => [HOME_TILE_LABELS[tile], counts.get(tile) ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`);
  return parts.length > 0 ? `Главная: плитки — ${parts.join(', ')}` : null;
}
