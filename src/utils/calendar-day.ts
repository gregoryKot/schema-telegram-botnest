import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

// Настоящий календарный день `YYYY-MM-DD` для DTO. До 2026-10-26 даты в
// DTO проверялись только регэкспом формы: срок задания `2026-02-31` и дата
// заметки сессии `2026-13-45`, `0000-00-00` проходили в БД и потом
// показывались как «NaN …» или сдвигались на месяц вперёд (QA-проход).
// День разбирается в UTC, как во всём проекте (правило №25): у строки нет
// зоны, и проверка не должна зависеть от зоны сервера.
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDay(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const m = DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Год до 1000 — опечатка, а не дата терапии; Date.UTC к тому же читает
  // годы 0–99 как 1900–1999.
  if (y < 1000 || mo < 1 || mo > 12 || d < 1) return false;
  const at = new Date(Date.UTC(y, mo - 1, d));
  return at.getUTCMonth() === mo - 1 && at.getUTCDate() === d;
}

/** class-validator: поле — настоящий календарный день `YYYY-MM-DD`. */
export function IsCalendarDay(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCalendarDay',
      validator: {
        validate: (value) => isCalendarDay(value),
        defaultMessage: buildMessage(
          (each) => `${each}$property must be a real calendar day YYYY-MM-DD`,
          options,
        ),
      },
    },
    options,
  );
}
