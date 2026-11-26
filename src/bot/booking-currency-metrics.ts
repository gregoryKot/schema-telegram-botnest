// Строка «валюту выбрали сами» в блоке «Деньги» /stats (правило №8; решение
// владельца Р5). Пояс без места (UTC и т. п.) даёт рубли с предоплатой, а
// посетитель не из России может выбрать шекели, евро или доллары — тогда бронь
// подтверждается сразу, без онлайн-оплаты. Строка показывает, как часто это
// случается: если часто — выбор, возможно, нажимают и те, кто в России.
// Событие пишет BookingService.book (booking-events.constants.ts); findMany
// через Prisma, не сырой SQL (правило №18). Язык простой: без «UTC» и «IANA».

import { PrismaService } from '../prisma/prisma.service';
import { BOOKING_CURRENCY_CHOSEN_EVENT } from '../analytics/booking-events.constants';
import { plural } from './plural';

/** Окно отчёта: событие редкое, недели мало. */
export const CURRENCY_CHOSEN_DAYS = 30;

/** Валюты, которые можно выбрать, в порядке вывода; рубли не выбираются. */
const CHOSEN = [
  ['EUR', 'евро'],
  ['USD', 'доллары'],
  ['ILS', 'шекели'],
] as const;

export type CurrencyChosenCounts = Partial<Record<string, number>>;

export async function countCurrencyChosen(
  prisma: PrismaService,
  now: number = Date.now(),
): Promise<CurrencyChosenCounts> {
  const rows = await prisma.analyticsEvent.findMany({
    // userId = null: событие пишет только сервер; подделка через POST
    // /api/event приходит со своим userId и в счёт не попадает.
    where: {
      name: BOOKING_CURRENCY_CHOSEN_EVENT,
      userId: null,
      createdAt: { gte: new Date(now - CURRENCY_CHOSEN_DAYS * 86_400_000) },
    },
    select: { meta: true },
  });
  const counts: CurrencyChosenCounts = {};
  for (const { meta } of rows) {
    const c = (meta as { currency?: unknown } | null)?.currency;
    if (typeof c === 'string') counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

/** Чистая функция. Выборов не было (в том числе пустая база) — строки нет. */
export function formatCurrencyChosen(counts: CurrencyChosenCounts): string[] {
  const parts = CHOSEN.filter(([code]) => (counts[code] ?? 0) > 0).map(
    ([code, name]) => `${name} — ${counts[code]}`,
  );
  if (parts.length === 0) return [];
  const total = CHOSEN.reduce((sum, [code]) => sum + (counts[code] ?? 0), 0);
  const bookings = plural(total, 'запись', 'записи', 'записей');
  return [
    `Часовой пояс не определился, и валюту выбрали сами (без онлайн-оплаты), за ${CURRENCY_CHOSEN_DAYS} дней: ${total} ${bookings} (${parts.join(', ')}).`,
  ];
}
