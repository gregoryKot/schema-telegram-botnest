import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { builtAt } from '../utils/build-info';

// Health-эндпоинт (аудит 2026-07, I-3): до него зависший процесс или потерянное
// соединение с БД были невидимы снаружи. Без auth-гарда — не раскрывает ничего,
// кроме факта живости; используется Docker HEALTHCHECK и внешним uptime-мониторингом.
//
// `builtAt` — время сборки образа (метка BUILD_INFO, смысл — в
// src/utils/build-info.ts). Инцидент 2026-09-16: два мержа сутки не были
// собраны хостингом, а /health и смок отвечали «ок» — проверяли «жив», не
// «свеж». Теперь смок прода сверяет эту метку с последним коммитом main
// (scripts/check-deploy-lag.mjs). Метки нет → null, а не 503: отсутствие
// метки — не сбой процесса, HEALTHCHECK не должен перезапускать контейнер.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; db: 'up'; builtAt: string | null }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return {
      status: 'ok',
      db: 'up',
      builtAt: builtAt()?.toISOString() ?? null,
    };
  }
}
