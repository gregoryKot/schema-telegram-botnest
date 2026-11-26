// Блок «Сессии не в рублях» для /stats (правило №8). Посетители из-за границы
// видят цену в шекелях, евро или долларах, онлайн-оплаты у них нет: бронь
// подтверждается сразу, а деньги владелец договаривается получить сам. Без
// блока такие сессии выглядели бы как обычные подтверждённые и их оплату
// легко забыть. Чистый форматтер, покрыт тестом, включая пустую базу.
// Язык простой: «в шекелях», «в евро», без кодов валют. Безличный, без «вы».
import type { Currency } from '../booking/price-region';

/** Сколько сессий в каждой не рублёвой валюте. */
export type CurrencyCounts = Partial<Record<Exclude<Currency, 'RUB'>, number>>;

export interface SessionCurrencyMetrics {
  /** Созданные за последние 7 дней. */
  week: CurrencyCounts;
  /** За всё время. */
  allTime: CurrencyCounts;
}

// Порядок в отчёте и названия «в чём»: шекели, евро, доллары.
const IN_CURRENCY: Array<[Exclude<Currency, 'RUB'>, string]> = [
  ['ILS', 'в шекелях'],
  ['EUR', 'в евро'],
  ['USD', 'в долларах'],
];

function total(c: CurrencyCounts): number {
  return IN_CURRENCY.reduce((sum, [code]) => sum + (c[code] ?? 0), 0);
}

/** «5 (3 в шекелях, 1 в евро, 1 в долларах)» либо «ни одной». */
function renderCounts(c: CurrencyCounts): string {
  const parts = IN_CURRENCY.filter(([code]) => (c[code] ?? 0) > 0).map(
    ([code, label]) => `${c[code]} ${label}`,
  );
  return parts.length === 0 ? 'ни одной' : `${total(c)} (${parts.join(', ')})`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatSessionCurrencyMetrics(
  m: SessionCurrencyMetrics,
): string {
  const lines = ['💱 <b>Сессии не в рублях</b>'];
  if (total(m.allTime) === 0) {
    lines.push('Пока таких сессий не было.');
    return lines.join('\n');
  }
  lines.push(
    'Оплата по договорённости, не через сайт: деньги нужно получить самому.',
    `За 7 дней: ${renderCounts(m.week)}`,
    `За всё время: ${renderCounts(m.allTime)}`,
  );
  return lines.join('\n');
}
