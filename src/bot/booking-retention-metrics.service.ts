import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  anonymizeDueAt,
  BOOKING_PII_RETENTION_MONTHS,
} from '../booking/booking-retention.service';
import {
  BookingRetentionMetrics,
  formatBookingRetention,
} from './booking-retention-metrics.format';
import { IntroLeadMetricsService } from './intro-lead-metrics.service';

const DAY_MS = 86_400_000;

// Счётчики для /stats: ночное стирание имени, контакта и текста запроса у
// броней старше 12 месяцев (booking-retention.service.ts). Считаем через
// Prisma count/findFirst, не сырым SQL: сырой запрос потребовал бы записи в
// scripts/raw-sql-live-baseline.json (правило №18), а здесь он не нужен.
// Свой домен — свой файл (правило №10), образец — data-export-metrics.service.ts.
//
// Второй блок этого же сервиса — «Заявки с формы знакомства» (intro-lead-
// metrics.service.ts): данные записей и заявок живут рядом, а новый провайдер
// в StatsReportService/BotModule упёрся бы в храповик размера этих файлов.
@Injectable()
export class BookingRetentionMetricsService {
  private readonly leads: IntroLeadMetricsService;

  constructor(private readonly prisma: PrismaService) {
    this.leads = new IntroLeadMetricsService(prisma);
  }

  /** Готовые текстовые блоки для /stats: данные записей + заявки со знакомства. */
  async render(): Promise<string> {
    const [retention, leads] = await Promise.all([
      this.getMetrics().then(formatBookingRetention),
      this.leads.render(),
    ]);
    return `${retention}\n\n${leads}`;
  }

  async getMetrics(now = new Date()): Promise<BookingRetentionMetrics> {
    const [anonymized, waiting, oldest] = await Promise.all([
      this.prisma.booking.count({ where: { anonymizedAt: { not: null } } }),
      this.prisma.booking.count({ where: { anonymizedAt: null } }),
      this.prisma.booking.findFirst({
        where: { anonymizedAt: null },
        orderBy: { startsAt: 'asc' },
        select: { startsAt: true },
      }),
    ]);
    // Срок самой старой из ждущих записей, в целых днях вперёд (округление
    // вверх: через час — это «сегодня», 0). Минус — срок вышел, а ночной прогон
    // его не забрал. `+ 0` убирает -0 у срока, вышедшего минуту назад.
    const daysToNext = oldest
      ? Math.ceil(
          (anonymizeDueAt(oldest.startsAt).getTime() - now.getTime()) / DAY_MS,
        ) + 0
      : null;
    return {
      monthsKept: BOOKING_PII_RETENTION_MONTHS,
      anonymized,
      waiting,
      daysToNext,
    };
  }
}
