// Подпись «за неделю» в карточке индекса.

/**
 * Нет данных — «—», а не ноль (ноль выдавался бы за измерение). Дельта, округлившаяся
 * до 0.0, — без знака: «−0.0» читается как падение, которого нет.
 */
export function formatWeekDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return '—';
  const text = Math.abs(delta).toFixed(1);
  if (Number(text) === 0) return text;
  return `${delta > 0 ? '+' : '−'}${text}`;
}

/** Направление для окраски: округлённая до нуля дельта — нейтральная. */
export function weekDeltaTone(delta: number | null): 'up' | 'down' | 'flat' {
  if (
    delta === null ||
    !Number.isFinite(delta) ||
    Number(Math.abs(delta).toFixed(1)) === 0
  )
    return 'flat';
  return delta > 0 ? 'up' : 'down';
}
