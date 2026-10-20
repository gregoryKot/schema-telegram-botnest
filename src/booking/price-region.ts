// Цена сессии по стране посетителя (решение владельца 2026-10-20): Россия —
// рубли и онлайн-оплата через Robokassa, Израиль — шекели, остальная Европа —
// евро, остальной мир — доллары. Вне рублей онлайн-оплаты нет: бронь
// подтверждается сразу, об оплате владелец договаривается сам.
//
// КОПИЯ shared/src/booking/priceRegion.ts (бэкенд не импортирует shared/, см.
// комментарий в client-timezone.ts); синхронность — price-region.sync.spec.ts
// (правило №4 CLAUDE.md). Правишь здесь — правь там.
export type PriceRegion = 'RU' | 'IL' | 'EU' | 'INTL';
export type Currency = 'RUB' | 'ILS' | 'EUR' | 'USD';

export const CURRENCIES: readonly Currency[] = ['RUB', 'ILS', 'EUR', 'USD'];

export const REGION_CURRENCY: Record<PriceRegion, Currency> = {
  RU: 'RUB',
  IL: 'ILS',
  EU: 'EUR',
  INTL: 'USD',
};

/** Знак валюты после суммы, как принято в русском тексте: «4 000 ₽», «70 $». */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  RUB: '₽',
  ILS: '₪',
  EUR: '€',
  USD: '$',
};

/** Пояса России (IANA, запад → восток, включая устаревшие синонимы браузеров). */
export const RU_TIME_ZONES: readonly string[] = [
  'Europe/Kaliningrad',
  'Europe/Moscow',
  'Europe/Simferopol',
  'Europe/Kirov',
  'Europe/Volgograd',
  'Europe/Astrakhan',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Barnaul',
  'Asia/Tomsk',
  'Asia/Novokuznetsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Chita',
  'Asia/Yakutsk',
  'Asia/Khandyga',
  'Asia/Vladivostok',
  'Asia/Ust-Nera',
  'Asia/Magadan',
  'Asia/Sakhalin',
  'Asia/Srednekolymsk',
  'Asia/Kamchatka',
  'Asia/Anadyr',
  'W-SU',
];

/** Пояса Израиля (канонический и синонимы). */
export const IL_TIME_ZONES: readonly string[] = ['Asia/Jerusalem', 'Asia/Tel_Aviv', 'Israel'];

/** Европа вне `Europe/*`: острова и устаревшие имена зон. */
export const EU_EXTRA_TIME_ZONES: readonly string[] = [
  'Atlantic/Canary',
  'Atlantic/Madeira',
  'Atlantic/Azores',
  'Atlantic/Faroe',
  'Atlantic/Faeroe',
  'Atlantic/Reykjavik',
  'Atlantic/Jan_Mayen',
  'CET',
  'EET',
  'WET',
  'MET',
];

/** Регион цены по IANA-поясу; пустой/неизвестный → 'RU'. */
export function regionFromTimeZone(tz: string | null | undefined): PriceRegion {
  if (!tz) return 'RU';
  if (RU_TIME_ZONES.includes(tz)) return 'RU';
  if (IL_TIME_ZONES.includes(tz)) return 'IL';
  if (tz.startsWith('Europe/') || EU_EXTRA_TIME_ZONES.includes(tz)) return 'EU';
  if (tz.startsWith('Asia/') || tz.startsWith('America/') || tz.startsWith('Africa/')) return 'INTL';
  if (tz.startsWith('Australia/') || tz.startsWith('Pacific/') || tz.startsWith('Indian/')) return 'INTL';
  if (tz.startsWith('Atlantic/') || tz.startsWith('Antarctica/') || tz.startsWith('Etc/') || tz === 'UTC') return 'INTL';
  // Строка не похожа на IANA-пояс (мусор из запроса) — рубли, как у пустого.
  return 'RU';
}

/** Валюта цены по поясу — короткая форма для вызывающих. */
export function currencyFromTimeZone(tz: string | null | undefined): Currency {
  return REGION_CURRENCY[regionFromTimeZone(tz)];
}

/** Онлайн-оплата (Robokassa) есть только в рублях. */
export function isOnlinePaymentCurrency(currency: Currency): boolean {
  return currency === 'RUB';
}

/** «4 000 ₽», «200 ₪», «70 $», «65 €» — разряды по-русски, знак после суммы. */
export function formatPrice(amount: number, currency: Currency): string {
  return `${amount.toLocaleString('ru-RU')} ${CURRENCY_SYMBOL[currency]}`;
}
