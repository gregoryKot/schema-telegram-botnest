const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function getDayAbbr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DOW_SHORT[new Date(y, m - 1, d).getDay()];
}

export function getDayNum(dateStr: string): string {
  return String(parseInt(dateStr.split('-')[2]));
}

/** Подпись оценки потребности и её уровень. */
export function needLevel(val: number): { label: string; level: 'ok' | 'warn' | 'err' } | null {
  if (val === 0) return null;
  if (val <= 3) return { label: 'низко', level: 'err' };
  if (val <= 6) return { label: 'средне', level: 'warn' };
  return { label: 'хорошо', level: 'ok' };
}
