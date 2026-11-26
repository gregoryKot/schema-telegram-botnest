import { offsetLabel } from '../booking/clientTimeZone';
import { cityLabel, isValidTimeZone } from '../utils/timeZoneNames';

// Часовые пояса выбора «Настройки → Часовой пояс» сайта и мини-аппа — один
// список и на /settings бота. До QA 2026-11-03 в нём не было России восточнее
// Москвы, а у Алматы стояло «UTC+6» (Казахстан с 01.03.2024 живёт по UTC+5).
// Смещение не пишется руками: его считает Intl на сегодняшнюю дату, поэтому
// летнее время Лондона или Нью-Йорка подпись не врёт.
//
// Копия — src/notification/notify-timezones.ts: бэкенд не импортирует
// shared/; сверку держит notify-timezones.sync.spec.ts (правило №4).
// Порядок — запад → восток.
export const NOTIFY_TIMEZONE_CITIES: ReadonlyArray<{
  iana: string;
  city: string;
}> = [
  { iana: 'America/Los_Angeles', city: 'Лос-Анджелес' },
  { iana: 'America/New_York', city: 'Нью-Йорк' },
  { iana: 'Europe/London', city: 'Лондон' },
  { iana: 'Europe/Berlin', city: 'Берлин, Варшава' },
  { iana: 'Europe/Kaliningrad', city: 'Калининград' },
  { iana: 'Europe/Kyiv', city: 'Киев' },
  { iana: 'Asia/Jerusalem', city: 'Израиль' },
  { iana: 'Europe/Moscow', city: 'Москва' },
  { iana: 'Europe/Samara', city: 'Самара' },
  { iana: 'Asia/Dubai', city: 'Дубай' },
  { iana: 'Asia/Yekaterinburg', city: 'Екатеринбург' },
  { iana: 'Asia/Tashkent', city: 'Ташкент' },
  { iana: 'Asia/Almaty', city: 'Алматы' },
  { iana: 'Asia/Omsk', city: 'Омск' },
  { iana: 'Asia/Novosibirsk', city: 'Новосибирск' },
  { iana: 'Asia/Krasnoyarsk', city: 'Красноярск' },
  { iana: 'Asia/Shanghai', city: 'Пекин' },
  { iana: 'Asia/Irkutsk', city: 'Иркутск' },
  { iana: 'Asia/Yakutsk', city: 'Якутск' },
  { iana: 'Asia/Vladivostok', city: 'Владивосток' },
  { iana: 'Asia/Magadan', city: 'Магадан' },
  { iana: 'Asia/Kamchatka', city: 'Камчатка' },
];

export interface TimezoneOption {
  iana: string;
  label: string;
}

function option(iana: string, city: string, at: Date): TimezoneOption {
  // Браузер со старой базой поясов не знает, например, Europe/Kyiv
  // (переименован в 2022): подпись без смещения лучше упавшего экрана.
  if (!isValidTimeZone(iana)) return { iana, label: city };
  return { iana, label: `${city} (${offsetLabel(iana, at)})` };
}

/**
 * Пункты выбора пояса. Текущий пояс, которого нет в списке (его определил
 * браузер: Париж, Бангкок), стоит первым — иначе выбор не показал бы, какой
 * пояс сейчас действует, и вернуть его после ошибки было бы нельзя.
 */
export function timezoneOptions(
  current?: string | null,
  at: Date = new Date(),
): TimezoneOption[] {
  const list = NOTIFY_TIMEZONE_CITIES.map((z) => option(z.iana, z.city, at));
  if (
    current &&
    !list.some((o) => o.iana === current) &&
    isValidTimeZone(current)
  ) {
    list.unshift(option(current, cityLabel(current), at));
  }
  return list;
}

/** Подпись пояса для строки настроек: «Владивосток (UTC+10)». */
export function timezoneLabel(iana: string, at: Date = new Date()): string {
  return timezoneOptions(iana, at).find((o) => o.iana === iana)?.label ?? iana;
}
