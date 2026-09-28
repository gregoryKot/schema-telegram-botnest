// Словарь русских названий популярных часовых поясов — источник для сайта
// (запись на консультацию, BookingPicker) и потенциально для бэкенда/мини-аппа.
// Не полный список IANA: города, которых реально ждём среди посетителей
// визитки (Россия от Калининграда до Камчатки, СНГ/Кавказ/Средняя Азия,
// Турция/Кипр/Греция/Сербия/Израиль/ОАЭ/Таиланд/Бали/Вьетнам/Корея/Япония,
// основная Европа, США/Канада восток-запад, пара городов Латинской Америки).
// Неизвестный пояс — фолбэк на последний сегмент IANA (см. cityLabel).

export const RUSSIAN_TZ_NAMES: Record<string, string> = {
  // Россия, запад → восток
  'Europe/Kaliningrad': 'Калининград',
  'Europe/Moscow': 'Москва',
  'Europe/Samara': 'Самара',
  'Asia/Yekaterinburg': 'Екатеринбург',
  'Asia/Omsk': 'Омск',
  'Asia/Novosibirsk': 'Новосибирск',
  'Asia/Krasnoyarsk': 'Красноярск',
  'Asia/Irkutsk': 'Иркутск',
  'Asia/Yakutsk': 'Якутск',
  'Asia/Vladivostok': 'Владивосток',
  'Asia/Sakhalin': 'Южно-Сахалинск',
  'Asia/Magadan': 'Магадан',
  'Asia/Kamchatka': 'Петропавловск-Камчатский',

  // СНГ, Кавказ, Средняя Азия
  'Europe/Minsk': 'Минск',
  'Europe/Kyiv': 'Киев',
  'Europe/Chisinau': 'Кишинёв',
  'Asia/Tbilisi': 'Тбилиси',
  'Asia/Yerevan': 'Ереван',
  'Asia/Baku': 'Баку',
  'Asia/Almaty': 'Алматы',
  'Asia/Bishkek': 'Бишкек',
  'Asia/Tashkent': 'Ташкент',
  'Asia/Dushanbe': 'Душанбе',
  'Asia/Ashgabat': 'Ашхабад',

  // Турция, Кипр, Греция, Сербия, Израиль, ОАЭ
  'Europe/Istanbul': 'Стамбул',
  'Asia/Nicosia': 'Кипр',
  'Asia/Famagusta': 'Кипр',
  'Europe/Athens': 'Афины',
  'Europe/Belgrade': 'Белград',
  'Asia/Jerusalem': 'Израиль',
  'Asia/Dubai': 'ОАЭ',

  // Таиланд, Бали, Вьетнам, Корея, Япония
  'Asia/Bangkok': 'Бангкок',
  'Asia/Makassar': 'Бали',
  'Asia/Ho_Chi_Minh': 'Вьетнам',
  'Asia/Seoul': 'Корея',
  'Asia/Tokyo': 'Япония',

  // Основная Европа
  'Europe/London': 'Лондон',
  'Europe/Lisbon': 'Лиссабон',
  'Europe/Madrid': 'Мадрид',
  'Europe/Paris': 'Париж',
  'Europe/Berlin': 'Берлин',

  // США, Канада
  'America/New_York': 'Нью-Йорк',
  'America/Chicago': 'Чикаго',
  'America/Denver': 'Денвер',
  'America/Los_Angeles': 'Лос-Анджелес',
  'America/Toronto': 'Торонто',

  // Латинская Америка
  'America/Mexico_City': 'Мехико',
  'America/Sao_Paulo': 'Сан-Паулу',
  'America/Buenos_Aires': 'Буэнос-Айрес',
};

/** Список для выпадающего выбора — порядок из словаря (по регионам, не алфавит). */
export const TIME_ZONE_OPTIONS: ReadonlyArray<{ tz: string; label: string }> =
  Object.keys(RUSSIAN_TZ_NAMES).map((tz) => ({
    tz,
    label: RUSSIAN_TZ_NAMES[tz],
  }));

/** `true`, если строка — распознаваемый Intl часовой пояс IANA. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Последний сегмент IANA-идентификатора как читаемое название («Asia/Krasnoyarsk» → «Krasnoyarsk»). */
function lastSegmentLabel(tz: string): string {
  const segment = tz.split('/').pop() ?? tz;
  return segment.replace(/_/g, ' ');
}

/** Русское название города/региона для пояса — из словаря, иначе IANA-хвост. */
export function cityLabel(tz: string): string {
  return RUSSIAN_TZ_NAMES[tz] ?? lastSegmentLabel(tz);
}
