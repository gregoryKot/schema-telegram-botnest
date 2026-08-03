import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Delivery, DeliveryFailure } from './channel-target';

/**
 * Журнал отправок канала «Здоровый Взрослый»: по строке на площадку на каждую
 * публикацию.
 *
 * Инцидент 2026-07-31: утренний пост вышел не везде, и ответить «что именно
 * случилось» было нечем — алерт не пришёл, логи хостинга живут недолго, а
 * догадки стоили владельцу вечера. Теперь исход каждой отправки лежит в БД, и
 * `/zv log` отвечает данными.
 *
 * Запись журнала никогда не роняет публикацию: пост уже ушёл, и упавший INSERT
 * не должен превращаться в «не дошло».
 */
@Injectable()
export class DeliveryLogService {
  private readonly logger = new Logger(DeliveryLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Записать исход одной публикации по всем площадкам. */
  async record(
    source: string,
    delivered: Delivery[],
    failed: DeliveryFailure[],
    text?: string,
  ): Promise<void> {
    const data = [
      ...delivered.map((d) => ({
        source,
        platform: d.platform,
        destination: d.destination,
        ok: true,
        text,
      })),
      ...failed.map((f) => ({
        source,
        platform: f.platform,
        destination: f.destination,
        ok: false,
        // Причина уже человекочитаемая (explain площадки); режем длину, чтобы
        // одна многословная ошибка не растянула весь отчёт.
        reason: f.reason.slice(0, 300),
        text,
      })),
    ];
    if (data.length === 0) return;
    await this.prisma.channelDelivery
      .createMany({ data })
      .catch((err: Error) =>
        this.logger.error(`channel delivery log failed: ${err?.message}`),
      );
  }

  /** Последние отправки, новые сверху. */
  recent(limit = 20) {
    return this.prisma.channelDelivery.findMany({
      orderBy: { id: 'desc' },
      take: limit,
    });
  }

  /**
   * Записи одного слота начиная с момента `since` — по ним считается, кому
   * досылать. Берём и повторы: успешный повтор закрывает долг площадки.
   */
  slotRows(source: string, since: Date) {
    return this.prisma.channelDelivery.findMany({
      where: { createdAt: { gte: since }, source: { startsWith: source } },
      orderBy: { id: 'desc' },
      take: 40,
    });
  }
}
