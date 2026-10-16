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
    // uptime jest-процесса не должен влиять на stale при ranAt: null.
    jest.spyOn(process, 'uptime').mockReturnValue(30);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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
      selfCheck: { ranAt: null, stale: false, failed: [] },
    });
  });

  // Отсутствие метки — локальный запуск или образ старее появления builtAt в
  // /health (см. src/utils/build-info.ts) — не признак сбоя БД/процесса,
  // поэтому статус остаётся ok, а не 503: HEALTHCHECK не должен краснеть
  // у живого контейнера только из-за отсутствующей метки сборки (перезапускать он
  // ничего не перезапускает, но unhealthy виден в `op=status`).
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
      selfCheck: { ranAt: null, stale: false, failed: [] },
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
          reportInHealth: true,
        },
        {
          id: 'caldav',
          title: 'Личный календарь',
          critical: false,
          ok: false,
          detail: 'секретная подробность, которой не место наружу',
          reportInHealth: true,
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

  // ciRuns (правило №21/№24): падение этой пробы не обязано красить /health —
  // иначе prod-smoke.yml, который сверяет /health.selfCheck.failed, падал бы
  // ПОТОМУ ЧТО проба сообщает, что он красный (петля).
  it('проба с reportInHealth: false — не попадает в failed, даже когда упала', async () => {
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
          reportInHealth: true,
        },
        {
          id: 'ciRuns',
          title: 'Ночная проверка и смок прода на GitHub',
          critical: false,
          ok: false,
          detail: 'смок прода красный: https://…',
          reportInHealth: false,
        },
      ],
      1_700_000_000_000,
    );
    const controller = new HealthController(prisma as unknown as PrismaService);
    const res = await controller.check();
    expect(res.selfCheck.failed).toEqual([]);
  });

  // Смок прода (prod-smoke.yml) красит себя по selfCheck.stale: остановившийся
  // часовой крон самопроверки иначе оставлял бы снимок «всё в порядке» зелёным.
  describe('selfCheck.stale', () => {
    const NOW = Date.parse('2026-10-16T12:00:00.000Z');
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const check = () =>
      new HealthController(prisma as unknown as PrismaService).check();

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW);
    });

    it('снимок 30 минут назад → stale: false', async () => {
      selfCheckState.set([], NOW - 30 * 60_000);
      expect((await check()).selfCheck.stale).toBe(false);
    });

    it('снимок 3 часа назад → stale: true, а status остаётся ok', async () => {
      selfCheckState.set([], NOW - 3 * 3_600_000);
      const res = await check();
      expect(res.selfCheck.stale).toBe(true);
      expect(res.status).toBe('ok');
    });

    it('снимка нет, процесс стартовал только что → stale: false', async () => {
      jest.spyOn(process, 'uptime').mockReturnValue(60);
      expect((await check()).selfCheck.stale).toBe(false);
    });

    it('снимка нет, а процесс живёт дольше грейса → stale: true', async () => {
      jest.spyOn(process, 'uptime').mockReturnValue(3_600);
      expect((await check()).selfCheck.stale).toBe(true);
    });
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
