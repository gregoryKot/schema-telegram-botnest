// /health — без auth-гарда, используется Docker HEALTHCHECK и внешним
// uptime-мониторингом (аудит 2026-07, I-3). Класс бага, который ловим: живой
// процесс, потерявший соединение с БД, обязан отвечать НЕ 200, иначе он
// невидим снаружи как «упавший».
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';
import { selfCheckState } from '../infra/self-check/state';
import { resetBuildInfo } from '../utils/build-info';

describe('HealthController', () => {
  beforeEach(() => {
    selfCheckState.reset();
    resetBuildInfo();
  });

  it('БД отвечает, самопроверка ещё не бежала → builtAt/ranAt null, failed пуст', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      builtAt: null,
      selfCheck: { ranAt: null, failed: [] },
    });
  });

  it('самопроверка бежала и нашла упавшие пробы → failed содержит их id, без деталей', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    selfCheckState.set(
      [
        {
          id: 'db',
          title: 'База данных',
          critical: true,
          ok: true,
          detail: 'отвечает',
        },
        {
          id: 'caldav',
          title: 'Личный календарь',
          critical: false,
          ok: false,
          detail: 'секретная подробность, которой не место наружу',
        },
      ],
      1_700_000_000_000,
    );
    const controller = new HealthController(prisma as unknown as PrismaService);
    const res = await controller.check();
    expect(res.selfCheck.failed).toEqual(['caldav']);
    expect(res.selfCheck.ranAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(JSON.stringify(res)).not.toContain('секретная подробность');
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
