import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Уборка строк ThrottleHit, которые уже никому не нужны: окно кончилось
 * больше суток назад и блока сейчас нет (или он тоже давно снят). Сутки
 * запаса — не для корректности (истёкшая строка и так трактуется как новое
 * окно, см. PostgresThrottleStorage), а чтобы таблица не росла бесконечно.
 *
 * Без leader-election (scripts/cron-leader-baseline.json — `exempt`):
 * `deleteMany` идемпотентен, второй инстанс на том же тике удалит те же
 * (уже удалённые) строки — 0 записей, дублирования наружу нет, тот же
 * принцип, что у analytics.service.ts::pruneOld.
 */
@Injectable()
export class ThrottleHitCleanupService {
  private readonly logger = new Logger(ThrottleHitCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('17 * * * *', { name: 'throttleHitCleanup' })
  async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.throttleHit.deleteMany({
      where: {
        expiresAt: { lt: cutoff },
        OR: [{ blockedUntil: null }, { blockedUntil: { lt: new Date() } }],
      },
    });
    if (count > 0) this.logger.log(`Удалено устаревших ThrottleHit: ${count}`);
  }
}
