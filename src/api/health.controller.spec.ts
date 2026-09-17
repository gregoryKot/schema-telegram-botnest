// /health — без auth-гарда, используется Docker HEALTHCHECK и внешним
// uptime-мониторингом (аудит 2026-07, I-3). Класс бага, который ловим: живой
// процесс, потерявший соединение с БД, обязан отвечать НЕ 200, иначе он
// невидим снаружи как «упавший».
//
// `builtAt` (инцидент 2026-09-16, правило №14 CLAUDE.md): смок прода
// сравнивает эту метку с последним коммитом main (scripts/check-deploy-lag.mjs)
// — здесь только контракт самого /health, сама сверка проверена в
// src/test-support/gates/deploy-lag.spec.ts.
jest.mock('../utils/build-info');
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';
import { selfCheckState } from '../infra/self-check/state';
import { builtAt } from '../utils/build-info';

const mockBuiltAt = builtAt as jest.Mock;

describe('HealthController', () => {
  beforeEach(() => {
    selfCheckState.reset();
    mockBuiltAt.mockReturnValue(null);
  });

  it('БД отвечает + есть метка сборки → 200 с { status: ok, db: up, builtAt: ISO }', async () => {
    const stamp = new Date('2026-09-16T10:08:00.000Z');
    mockBuiltAt.mockReturnValue(stamp);
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      builtAt: '2026-09-16T10:08:00.000Z',
      selfCheck: { ranAt: null, failed: [] },
    });
  });

  // Отсутствие метки — локальный запуск или образ старее появления builtAt в
  // /health (см. src/utils/build-info.ts) — не признак сбоя БД/процесса,
  // поэтому статус остаётся ok, а не 503: Docker HEALTHCHECK не обязан
  // перезапускать живой контейнер только из-за отсутствующей метки сборки.
  it('метки сборки нет, самопроверка ещё не бежала → 200, builtAt/ranAt null, failed пуст', async () => {
    mockBuiltAt.mockReturnValue(null);
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
    mockBuiltAt.mockReturnValue(null);
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
