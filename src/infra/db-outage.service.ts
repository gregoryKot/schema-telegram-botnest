import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { dbOutage, DB_ALERT_SUBJECT } from '../logger/db-outage';
import { notifyAdminWithFallback } from '../utils/admin-alert';

// Инцидент 2026-08-31 (см. src/logger/db-outage.ts): DbOutageTracker
// открывает аварию по первой ошибке, но закрыть её самой некому — ошибки
// просто перестают приходить, когда БД снова доступна. Этот сторожок раз в
// минуту сам проверяет соединение и закрывает аварию, отправляя DM о
// восстановлении.
@Injectable()
export class DbOutageMonitorService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron('* * * * *', { name: 'dbOutageProbe' })
  async probe(): Promise<void> {
    // Авария не открыта — незачем дёргать БД лишним запросом каждую минуту.
    if (!dbOutage.isOpen) return;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // БД всё ещё недоступна — это ожидаемо, пока авария открыта. Не
      // логируем: error() здесь ушёл бы в AlertLogger и создал бы алерт из
      // алерта, а warn засорил бы обычные логи тем же сообщением раз в минуту.
      return;
    }
    const text = dbOutage.resolve();
    if (text) void notifyAdminWithFallback(text, DB_ALERT_SUBJECT);
  }
}
