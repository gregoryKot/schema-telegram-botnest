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
import { PROCESS_STARTED_AT_MS } from './health-report';
import { STARTUP_ENV } from '../telegram/start-launch-env';

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
      startedAt: new Date(PROCESS_STARTED_AT_MS).toISOString(),
      launch: null,
      crashesDay: null,
    });
  });

  // Отсутствие метки — локальный запуск или образ старее появления builtAt в
  // /health (см. src/utils/build-info.ts) — не признак сбоя БД/процесса,
  // поэтому статус остаётся ok, а не 503: HEALTHCHECK не должен краснеть
  // у живого контейнера только из-за отсутствующей метки сборки (перезапускать он
  // ничего не перезапускает, но unhealthy виден оркестратору).
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
      startedAt: new Date(PROCESS_STARTED_AT_MS).toISOString(),
      launch: null,
      crashesDay: null,
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
          ok: true,
          detail: 'отвечает',
          reportInHealth: true,
        },
        {
          id: 'caldav',
          title: 'Личный календарь',
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
          ok: true,
          detail: 'отвечает',
          reportInHealth: true,
        },
        {
          id: 'ciRuns',
          title: 'Ночная проверка и смок прода на GitHub',
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

  // Аудит 2026-10 («Красный смок не говорит, что лежит»): рестарт приложения
  // внутри живого контейнера снаружи был не виден. Номер запуска и падения за
  // сутки считает супервизор (deploy/crash-window.mjs) и передаёт через env —
  // те же имена, что читает DM о старте (src/telegram/start-launch-env.ts).
  describe('startedAt, launch, crashesDay', () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const check = () =>
      new HealthController(prisma as unknown as PrismaService).check();
    const saved = {
      launch: process.env[STARTUP_ENV.launch],
      crashes: process.env[STARTUP_ENV.crashes],
    };
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    afterEach(() => {
      restore(STARTUP_ENV.launch, saved.launch);
      restore(STARTUP_ENV.crashes, saved.crashes);
    });

    it('перезапуск после падений: номер запуска и падения за сутки — числами', async () => {
      process.env[STARTUP_ENV.launch] = '3';
      process.env[STARTUP_ENV.crashes] = '2';
      const res = await check();
      expect(res.launch).toBe(3);
      expect(res.crashesDay).toBe(2);
    });

    it('без супервизора (локальный запуск) или мусор в env — null, а не NaN', async () => {
      delete process.env[STARTUP_ENV.launch];
      process.env[STARTUP_ENV.crashes] = 'abc';
      const res = await check();
      expect(res.launch).toBeNull();
      expect(res.crashesDay).toBeNull();
    });

    it('startedAt — момент старта процесса: ISO, в прошлом, один и тот же между запросами', async () => {
      jest.restoreAllMocks(); // настоящий uptime
      const before = Date.now();
      const first = await check();
      const second = await check();
      expect(first.startedAt).toBe(second.startedAt);
      const at = Date.parse(first.startedAt);
      expect(new Date(at).toISOString()).toBe(first.startedAt);
      expect(at).toBeLessThanOrEqual(before);
      expect(before - at).toBeLessThanOrEqual(process.uptime() * 1000 + 1000);
    });

    // Смок и HEALTHCHECK читают /health по полям и подстроке — новые поля
    // аддитивны и не сдвигают маркеры, которые они ищут.
    it('маркеры смока и HEALTHCHECK на месте', async () => {
      const body = JSON.stringify(await check());
      expect(body).toContain('"status":"ok"');
      expect(body).toContain('"db":"up"');
      expect(body).toContain('"failed":[]');
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
