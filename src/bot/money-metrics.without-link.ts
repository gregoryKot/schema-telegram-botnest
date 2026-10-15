// Строка блока «Деньги» для /stats: подтверждённые записи, у которых ещё не
// готовы ссылка на встречу или календарь (правило №8, security#21). Эффекты
// подтверждения могли не доехать после оплаты; число «застрявших» видно сразу,
// а не после жалобы клиента. Считаем по флагу `confirmEffectsDoneAt`, а не по
// пустой ссылке: бронь со ссылкой, но без записи в календарь, тоже застряла. Отдельный файл: money-metrics.* под храповиком размера.
// Язык простой: без «meetingUrl», «CONFIRMED» и «крон».

import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MoneyMetrics,
  formatMoneyMetrics,
  windowIsEmpty,
} from './money-metrics.format';

/** Подтверждено, начало впереди, а эффекты (ссылка, календарь) не доведены. count, не сырой SQL (правило №18). */
export function countConfirmedWithoutLink(
  prisma: PrismaService,
): Promise<number> {
  return prisma.booking.count({
    where: {
      status: BookingStatus.CONFIRMED,
      confirmEffectsDoneAt: null,
      startsAt: { gt: new Date() },
    },
  });
}

/** Чистая функция. Пустая база: строки нет вовсе (отчёт остаётся «Пока никто не платил»). */
export function formatWithoutLink(n: number, moneyIsEmpty: boolean): string[] {
  if (n > 0) {
    return [
      `⚠️ Подтверждённых записей, где ещё не готовы ссылка или календарь: ${n}`,
      'Бот сам пробует доделать каждые 5 минут. Если число не уходит, клиенту нужно отправить ссылку вручную, а календарь проверить.',
    ];
  }
  return moneyIsEmpty
    ? []
    : ['Подтверждённых записей, где ещё не готовы ссылка или календарь: нет.'];
}

/** Готовый блок «Деньги»: основной отчёт плюс строка про ссылки. */
export async function renderMoneyBlock(
  prisma: PrismaService,
  metrics: MoneyMetrics,
): Promise<string> {
  const stuck = await countConfirmedWithoutLink(prisma);
  const extra = formatWithoutLink(stuck, windowIsEmpty(metrics.allTime));
  return [
    formatMoneyMetrics(metrics),
    ...(extra.length ? ['', ...extra] : []),
  ].join('\n');
}
