import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Health-эндпоинт (аудит 2026-07, I-3): до него зависший процесс или потерянное
// соединение с БД были невидимы снаружи. Без auth-гарда — не раскрывает ничего,
// кроме факта живости; используется Docker HEALTHCHECK и внешним uptime-мониторингом.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; db: 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'up' };
  }
}
