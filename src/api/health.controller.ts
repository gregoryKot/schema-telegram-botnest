import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { healthDetails, type HealthReport } from './health-report';

// Health-эндпоинт (аудит 2026-07, I-3): зависший процесс или потерянная БД
// были невидимы снаружи. Без auth-гарда; нужен Docker HEALTHCHECK и
// uptime-мониторингу. БД не отвечает → 503; остальное тело — свежесть сборки,
// самопроверка, старт процесса — и почему поля такие: src/api/health-report.ts.
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
    return { status: 'ok', db: 'up', ...healthDetails() };
  }
}
