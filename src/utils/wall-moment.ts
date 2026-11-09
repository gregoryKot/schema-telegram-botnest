import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';
import { isCalendarDay } from './calendar-day';

// День или настенное время `YYYY-MM-DDTHH:mm[:ss]` без зоны (datetime-local
// сайта, `SessionInfoDto.nextSession`). До 2026-11 форма сверялась регэкспом,
// и `2026-02-30T25:00` проходил в БД: день сверяется как `isCalendarDay`
// (src/utils/calendar-day.ts), часы 00–23, минуты и секунды 00–59.
const WALL_TIME = /^T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function isDayOrWallMoment(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const rest = value.slice(10);
  return (
    isCalendarDay(value.slice(0, 10)) && (rest === '' || WALL_TIME.test(rest))
  );
}

/** class-validator: поле — день `YYYY-MM-DD` или `YYYY-MM-DDTHH:mm[:ss]`. */
export function IsDayOrWallMoment(
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDayOrWallMoment',
      validator: {
        validate: (value) => isDayOrWallMoment(value),
        defaultMessage: buildMessage(
          (each) =>
            `${each}$property must be a real day YYYY-MM-DD or YYYY-MM-DDTHH:mm[:ss]`,
          options,
        ),
      },
    },
    options,
  );
}
