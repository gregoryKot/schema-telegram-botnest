import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
} from './analytics.constants';

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

  async track(
    userId: bigint,
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
}
