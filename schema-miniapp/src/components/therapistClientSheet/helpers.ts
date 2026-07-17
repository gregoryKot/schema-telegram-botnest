export const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function calcTherapyDuration(startDateStr: string): string {
  const start = new Date(startDateStr);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (months < 1) {
    const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
    if (days < 1) return 'сегодня';
    const m10 = days % 10,
      m100 = days % 100;
    const w =
      m100 >= 11 && m100 <= 19
        ? 'дней'
        : m10 === 1
          ? 'день'
          : m10 >= 2 && m10 <= 4
            ? 'дня'
            : 'дней';
    return `${days} ${w}`;
  }
  const m10 = months % 10,
    m100 = months % 100;
  const w =
    m100 >= 11 && m100 <= 19
      ? 'месяцев'
      : m10 === 1
        ? 'месяц'
        : m10 >= 2 && m10 <= 4
          ? 'месяца'
          : 'месяцев';
  return `${months} ${w}`;
}

export function nextSessionLabel(dateStr: string): string {
  const [datePart, timePart] = dateStr.includes('T')
    ? dateStr.split('T')
    : [dateStr, null];
  const [, m, d] = datePart.split('-');
  const MONTHS = [
    'янв',
    'фев',
    'мар',
    'апр',
    'май',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];
  const date = new Date(datePart + 'T00:00:00');
  const base = `${DAY_NAMES[date.getDay()]}, ${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`;
  return timePart ? `${base} · ${timePart}` : base;
}

export function streakEmoji(s: number) {
  if (s >= 7) return '🔥';
  if (s >= 1) return '🌱';
  return '🫥';
}
export function indexColor(v: number) {
  if (v >= 7) return '#06d6a0';
  if (v >= 4) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}
