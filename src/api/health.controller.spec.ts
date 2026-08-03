// /health — без auth-гарда, используется Docker HEALTHCHECK и внешним
// uptime-мониторингом (аудит 2026-07, I-3). Класс бага, который ловим: живой
// процесс, потерявший соединение с БД, обязан отвечать НЕ 200, иначе он
// невидим снаружи как «упавший».
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('БД отвечает → 200 с { status: ok, db: up }', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
  });

  it('БД недоступна → 503, а не 200 и не голый throw соединения', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
