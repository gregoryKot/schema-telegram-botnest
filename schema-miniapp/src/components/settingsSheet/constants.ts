// Константы и хелперы уведомлений (вынесено из SettingsSheet.tsx).

export const TIMEZONES = [
  { label: 'Лос-Анджелес (UTC−8)', iana: 'America/Los_Angeles' },
  { label: 'Нью-Йорк (UTC−5)', iana: 'America/New_York' },
  { label: 'Лондон (UTC+0)', iana: 'Europe/London' },
  { label: 'Берлин (UTC+1)', iana: 'Europe/Berlin' },
  { label: 'Киев / Израиль (UTC+2)', iana: 'Europe/Kyiv' },
  { label: 'Москва (UTC+3)', iana: 'Europe/Moscow' },
  { label: 'Дубай (UTC+4)', iana: 'Asia/Dubai' },
  { label: 'Ташкент (UTC+5)', iana: 'Asia/Tashkent' },
  { label: 'Алматы (UTC+6)', iana: 'Asia/Almaty' },
  { label: 'Пекин (UTC+8)', iana: 'Asia/Shanghai' },
];

export const HOURS = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
];

export const FREQ_LABELS = [
  'Каждый день',
  'Через день',
  'Пару раз в неделю',
  'Раз в неделю',
];

// Пресеты тихих часов: start===end → выключены
export const QUIET_PRESETS = [
  { label: 'Выключены', start: 0, end: 0 },
  { label: '21:00 – 08:00', start: 21, end: 8 },
  { label: '22:00 – 08:00', start: 22, end: 8 },
  { label: '23:00 – 07:00', start: 23, end: 7 },
  { label: '00:00 – 08:00', start: 0, end: 8 },
];

export function quietLabel(start?: number, end?: number): string {
  if (start === undefined || end === undefined || start === end)
    return 'Выключены';
  return `${pad(start)}:00 – ${pad(end)}:00`;
}

/** Час уведомления внутри окна тишины? (окно может переходить через полночь) */
export function hourInQuiet(
  hour: number,
  start?: number,
  end?: number,
): boolean {
  if (start === undefined || end === undefined || start === end) return false;
  return start > end
    ? hour >= start || hour < end
    : hour >= start && hour < end;
}

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export type View = 'main' | 'time' | 'tz' | 'freq' | 'quiet';
