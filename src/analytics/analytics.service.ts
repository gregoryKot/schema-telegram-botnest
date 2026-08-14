import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
} from './analytics.constants';

// Ретеншен AnalyticsEvent (L10, аудит 2026-08): таблица росла без ограничения.
// Метрики /stats считаются в окнах ≤30 дней, поэтому держим 90 (щедрый буфер) и
// раз в сутки удаляем старше — диск не течёт, окна метрик не задеты.
const RETENTION_DAYS = 90;

// Продуктовая аналитика (правило №8 CLAUDE.md): пишет факты «юзер сделал X»
// для проверки гипотез метриками (D1/D7/D30, доля поделившихся и т.п.).
//
// Инвариант: запись события НИКОГДА не должна ломать пользовательское
// действие. track() глотает любые ошибки БД (логирует) и не бросает —
// вызывающий эндпоинт всегда отвечает быстро и успешно.
//
// meta — маленький структурный non-PII объект (валидируется DTO). Свободный
// текст пользователя сюда не попадает (не шифруется).
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** userId = null — анонимное событие публичного сайта (мини-тесты). */
  async track(
    userId: bigint | null,
    name: AnalyticsEventName,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    // Defence in depth: DTO уже проверил name, но сервис — нижний слой,
    // к которому могут прийти и из других мест (бот, крон). Неизвестное
    // имя молча игнорируем, а не засоряем таблицу.
    if (!ANALYTICS_EVENTS.includes(name)) return;
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          userId,
          name,
          meta: (meta as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    } catch (err) {
      this.logger.error(`track(${name}) failed`, err as Error);
    }
  }

  /** Ретеншен: раз в сутки чистим события старше RETENTION_DAYS (L10). */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async pruneOld(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    try {
      const { count } = await this.prisma.analyticsEvent.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (count > 0)
        this.logger.log(
          `analytics prune: удалено ${count} событий старше ${RETENTION_DAYS} дней`,
        );
    } catch (err) {
      this.logger.error('analytics prune failed', err as Error);
    }
  }
}
