// Копия словаря из shared/src/utils/timeZoneNames.ts — см. комментарий в
// client-timezone.ts про то, почему backend не импортирует shared/ напрямую.
// Синхронность со shared проверяется в client-timezone.sync.spec.ts.
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

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function lastSegmentLabel(tz: string): string {
  const segment = tz.split('/').pop() ?? tz;
  return segment.replace(/_/g, ' ');
}

export function cityLabel(tz: string): string {
  return RUSSIAN_TZ_NAMES[tz] ?? lastSegmentLabel(tz);
}
