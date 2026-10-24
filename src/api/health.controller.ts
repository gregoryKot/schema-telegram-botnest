import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { builtAt } from '../utils/build-info';
import { selfCheckState } from '../infra/self-check/state';
import { isSnapshotStale } from '../infra/self-check/freshness';

// Health-эндпоинт (аудит 2026-07, I-3): зависший процесс или потерянная БД
// были невидимы снаружи. Без auth-гарда; нужен Docker HEALTHCHECK и uptime-мониторингу.
// builtAt/selfCheck — правило №14: смок сверяет свежесть builtAt, пустоту failed
// (только id проб, детали в DM и /stats) и selfCheck.stale (крон остановился;
// status при этом остаётся ok — HEALTHCHECK не должен откатывать здоровый релиз).
export interface HealthReport {
  status: 'ok';
  db: 'up';
  builtAt: string | null;
  selfCheck: { ranAt: string | null; stale: boolean; failed: string[] };
}
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
  async check(): Promise<HealthReport> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    const snap = selfCheckState.get();
    return {
      status: 'ok',
      db: 'up',
      builtAt: builtAt()?.toISOString() ?? null,
      selfCheck: {
        ranAt: snap.ranAt === null ? null : new Date(snap.ranAt).toISOString(),
        stale: isSnapshotStale(snap, Date.now(), process.uptime() * 1000),
        failed: snap.results
          .filter((r) => !r.ok && r.reportInHealth)
          .map((r) => r.id),
      },
    };
  }
}
