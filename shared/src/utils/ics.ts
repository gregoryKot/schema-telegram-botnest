// Генерация .ics-события «Напомнить завтра» для PlanSheet (оба фронтенда,
// правило №3 — раньше жила только в мини-аппе, паритет фич правило №16).
// Чистая функция: дата/час считаются от переданных параметров, побочных
// эффектов нет — платформенное сохранение файла (`getHost().saveFile`)
// остаётся на стороне каждого PlanSheet.
export interface PracticeIcsParams {
  /** Текст практики — уходит в SUMMARY как есть, без экранирования (нет
   * переносов строк/спецсимволов ICS в источнике — практика вводится в
   * однострочном textarea/выбирается из готового списка). */
  text: string;
  needLabel: string;
  /** Час напоминания в ЛОКАЛЬНОМ времени пользователя; null — без выбранного
   * времени, событие ставится на 09:00 по умолчанию. */
  localHour: number | null;
  /** Смещение локального часового пояса пользователя от UTC, в часах. */
  tzOffset: number;
}

export function buildPracticeIcs({
  text,
  needLabel,
  localHour,
  tzOffset,
}: PracticeIcsParams): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h =
    localHour !== null
      ? String((((localHour - tzOffset) % 24) + 24) % 24).padStart(2, '0')
      : '09';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schema//Schema//RU',
    'BEGIN:VEVENT',
    `DTSTART:${y}${mo}${d}T${h}0000Z`,
    `DTEND:${y}${mo}${d}T${h}3000Z`,
    `SUMMARY:${text}`,
    `DESCRIPTION:Практика для потребности: ${needLabel}`,
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
