// Чистая функция сборки ссылки «Добавить в Google Календарь» — вынесена
// отдельно от разметки, чтобы формат дат и кодирование были тестируемы без
// рендера (правило «Тесты» CLAUDE.md).
export interface GoogleCalendarEventInput {
  title: string;
  /** ISO-момент начала (с зоной) — на выходе всегда UTC, Google сам покажет
   *  время в зоне зрителя календаря. */
  startsAt: string;
  durationMin: number;
  details: string;
}

/** YYYYMMDDTHHMMSSZ в UTC — тот же формат, что у .ics (RFC 5545 §3.3.5). */
function fmtUtc(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function buildGoogleCalendarUrl(opts: GoogleCalendarEventInput): string {
  const end = new Date(
    new Date(opts.startsAt).getTime() + opts.durationMin * 60_000,
  ).toISOString();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmtUtc(opts.startsAt)}/${fmtUtc(end)}`,
    details: opts.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
