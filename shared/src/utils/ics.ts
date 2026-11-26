// Генерация .ics-события «Напомнить завтра» для PlanSheet (правило №3).
// Чистые функции от параметров; сохранение файла — `getHost().saveFile`.
import { planEventStartMs } from './planEventStart';
export interface PracticeIcsParams {
  /** Текст практики — уходит в SUMMARY как есть, без экранирования (нет
   * переносов строк/спецсимволов ICS в источнике — практика вводится в
   * однострочном textarea/выбирается из готового списка). */
  text: string;
  needLabel: string;
  /** Час напоминания в ЛОКАЛЬНОМ времени пользователя; null — без выбранного
   * времени, событие ставится на 09:00 местного. */
  localHour: number | null;
  /** Смещение локального часового пояса пользователя от UTC, в часах. */
  tzOffset: number;
}

/** YYYYMMDDTHHMMSSZ (RFC 5545 §3.3.5). */
const icsUtc = (ms: number) =>
  new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');

export function buildPracticeIcs(p: PracticeIcsParams): string {
  const { text, needLabel } = p;
  const start = planEventStartMs(p.localHour, p.tzOffset);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schema//Schema//RU',
    'BEGIN:VEVENT',
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(start + 30 * 60_000)}`,
    `SUMMARY:${text}`,
    `DESCRIPTION:Практика для потребности: ${needLabel}`,
    // Сигнал в момент начала: календарь — единственное напоминание у тех,
    // кому не доходит Telegram (U5); без VALARM событие молчит.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** data: URL готовый к `getHost().saveFile(url, 'practice.ics')`. */
export function practiceIcsDataUrl(params: PracticeIcsParams): string {
  return (
    'data:text/calendar;charset=utf-8,' +
    encodeURIComponent(buildPracticeIcs(params))
  );
}
