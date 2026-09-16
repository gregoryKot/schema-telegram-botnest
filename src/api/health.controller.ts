import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { builtAt } from '../utils/build-info';
import { selfCheckState } from '../infra/self-check/state';

// Health-эндпоинт (аудит 2026-07, I-3): до него зависший процесс или потерянное
// соединение с БД были невидимы снаружи. Без auth-гарда — не раскрывает ничего,
// кроме факта живости; используется Docker HEALTHCHECK и внешним uptime-мониторингом.
//
// builtAt/selfCheck — правило №14 CLAUDE.md: между «CI зелёный» и «у
// пользователя работает» есть деплой и живые площадки, и ни один наблюдатель
// после деплоя не спрашивал «а интеграции живые?». selfCheck.failed — только
// id упавших проб (без деталей/секретов — они у владельца в DM и в /stats),
// внешний прод-смок сверяет свежесть builtAt и пустоту failed.
export interface HealthReport {
  status: 'ok';
  db: 'up';
  builtAt: string | null;
  selfCheck: { ranAt: string | null; failed: string[] };
}

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
        failed: snap.results.filter((r) => !r.ok).map((r) => r.id),
      },
    };
  }
}
