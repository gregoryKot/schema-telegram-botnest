import { isValidTimeZone } from '../booking/client-timezone';

// Часовые пояса выбора: /settings бота, «Настройки → Часовой пояс» сайта и
// мини-аппа. До QA 2026-11-03 списков было три (VALID_TIMEZONES, кнопки бота,
// shared/src/settings/constants.ts), и ни в одном не было России восточнее
// Москвы, а Алматы стоял с UTC+6 (Казахстан с 01.03.2024 живёт по UTC+5).
// Смещение здесь не хранится: его считает Intl на нужную дату.
//
// Копия shared/src/settings/timezones.ts — бэкенд не импортирует shared/
// (rootDir — src, см. src/booking/client-timezone.ts); сверку держит
// notify-timezones.sync.spec.ts (правило №4). Порядок — запад → восток.
export const NOTIFY_TIMEZONES: ReadonlyArray<{ tz: string; label: string }> = [
  { tz: 'America/Los_Angeles', label: 'Лос-Анджелес' },
  { tz: 'America/New_York', label: 'Нью-Йорк' },
  { tz: 'Europe/London', label: 'Лондон' },
  { tz: 'Europe/Berlin', label: 'Берлин, Варшава' },
  { tz: 'Europe/Kaliningrad', label: 'Калининград' },
  { tz: 'Europe/Kyiv', label: 'Киев' },
  { tz: 'Asia/Jerusalem', label: 'Израиль' },
  { tz: 'Europe/Moscow', label: 'Москва' },
  { tz: 'Europe/Samara', label: 'Самара' },
  { tz: 'Asia/Dubai', label: 'Дубай' },
  { tz: 'Asia/Yekaterinburg', label: 'Екатеринбург' },
  { tz: 'Asia/Tashkent', label: 'Ташкент' },
  { tz: 'Asia/Almaty', label: 'Алматы' },
  { tz: 'Asia/Omsk', label: 'Омск' },
  { tz: 'Asia/Novosibirsk', label: 'Новосибирск' },
  { tz: 'Asia/Krasnoyarsk', label: 'Красноярск' },
  { tz: 'Asia/Shanghai', label: 'Пекин' },
  { tz: 'Asia/Irkutsk', label: 'Иркутск' },
  { tz: 'Asia/Yakutsk', label: 'Якутск' },
  { tz: 'Asia/Vladivostok', label: 'Владивосток' },
  { tz: 'Asia/Magadan', label: 'Магадан' },
  { tz: 'Asia/Kamchatka', label: 'Камчатка' },
];

export const VALID_TIMEZONES: string[] = NOTIFY_TIMEZONES.map((t) => t.tz);

/** Самый длинный идентификатор IANA короче 40 символов; 64 — с запасом. */
export const TIMEZONE_MAX_LENGTH = 64;

/**
 * Пояс, который можно записать в `notifyTimezone`: из списка выбора или любой
 * настоящий пояс IANA. Второе — для пояса, определённого браузером: человек
 * из Парижа не обязан выбирать «Берлин», чтобы его день совпал с днём сервера.
 */
export function isNotifyTimezone(tz: unknown): tz is string {
  return (
    typeof tz === 'string' &&
    tz.length > 0 &&
    tz.length <= TIMEZONE_MAX_LENGTH &&
    isValidTimeZone(tz)
  );
}
