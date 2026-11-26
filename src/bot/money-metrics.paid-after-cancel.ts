// Строка блока «Деньги» для /stats: оплатили уже отменённую запись (CANCELLED
// с paidAt, аудит 2026-10). Деньги пришли, а записи нет — владельцу об этом
// ушёл один DM (payment.booking-webhook.ts), дальше случай держала только его
// память. Число в отчёте не даёт ему потеряться. «Оплатили сессию» такую
// оплату тоже считает (money-metrics.paid-sessions.ts) — эта строка говорит,
// сколько из них без записи. Отдельный файл: money-metrics.* под храповиком
// размера. Язык простой: без «CANCELLED», «paidAt» и «вебхук».

import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { times } from './money-metrics.format';

export interface PaidAfterCancel {
  /** Оплата пришла за последние 7 дней. */
  week: number;
  /** За всё время учёта оплат. */
  allTime: number;
}

/** count через Prisma, не сырой SQL (правило №18). Окно — по дате оплаты. */
export async function countPaidAfterCancel(
  prisma: PrismaService,
  now: number = Date.now(),
): Promise<PaidAfterCancel> {
  const since = new Date(now - 7 * 86_400_000);
  const [week, allTime] = await Promise.all([
    prisma.booking.count({
      where: { status: BookingStatus.CANCELLED, paidAt: { gte: since } },
    }),
    prisma.booking.count({
      where: { status: BookingStatus.CANCELLED, paidAt: { not: null } },
    }),
  ]);
  return { week, allTime };
}

/** Чистая функция. Пустая база: строки нет вовсе (блок говорит «Пока никто не платил»). */
export function formatPaidAfterCancel(
  n: PaidAfterCancel,
  moneyIsEmpty: boolean,
): string[] {
  if (n.allTime === 0) {
    return moneyIsEmpty ? [] : ['Оплатили уже отменённую запись: ни разу.'];
  }
  if (n.week === 0) {
    return [
      `Оплатили уже отменённую запись: за 7 дней ни разу, за всё время — ${times(n.allTime)}.`,
    ];
  }
  return [
    `⚠️ Оплатили уже отменённую запись за 7 дней: ${times(n.week)} (за всё время — ${times(n.allTime)}).`,
    'Деньги пришли, а записи нет: клиенту нужно вернуть оплату или предложить новое время.',
  ];
}
