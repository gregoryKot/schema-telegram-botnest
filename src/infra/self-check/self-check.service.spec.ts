jest.mock('./registry', () => ({ buildProbes: jest.fn() }));
jest.mock('../../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

import { SelfCheckService } from './self-check.service';
import { buildProbes } from './registry';
import { notifyAdminWithFallback } from '../../utils/admin-alert';
import { selfCheckState } from './state';
import { selfCheckAlerts } from './alert-tracker';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CronLeaderService } from '../cron-leader.service';
import type { Probe } from './types';

const mockedBuildProbes = buildProbes as jest.Mock;
const mockedNotify = notifyAdminWithFallback as jest.Mock;

function okProbe(id: string): Probe {
  return {
    id,
    title: `Проба ${id}`,
    run: async () => ({ ok: true, detail: 'ок' }),
  };
}
function failProbe(id: string, detail = 'сломано'): Probe {
  return {
    id,
    title: `Проба ${id}`,
    run: async () => ({ ok: false, detail }),
  };
}

/** Строки CronLease, общие для «процессов» теста, — как база для инстансов. */
type LeaseRows = Map<string, number>;

function makeService(
  claimRun: jest.Mock = jest.fn().mockResolvedValue(true),
  rows: LeaseRows = new Map(),
) {
  const claimRunOrThrow = jest.fn((name: string, windowMs: number) => {
    const at = rows.get(name);
    if (at !== undefined && Date.now() - at < windowMs) return false;
    rows.set(name, Date.now());
    return true;
  });
  const deleteMany = jest.fn(
    ({ where }: { where: { name: { startsWith: string } } }) => {
      const names = [...rows.keys()].filter((n) =>
        n.startsWith(where.name.startsWith),
      );
      names.forEach((n) => rows.delete(n));
      return { count: names.length };
    },
  );
  const prisma = { cronLease: { deleteMany } } as unknown as PrismaService;
  const cronLeader = {
    claimRun,
    claimRunOrThrow,
  } as unknown as CronLeaderService;
  return { service: new SelfCheckService(prisma, cronLeader), claimRun, rows };
}

beforeEach(() => {
  mockedBuildProbes.mockReset();
  mockedNotify.mockClear();
  selfCheckState.reset();
  selfCheckAlerts.reset();
});

describe('SelfCheckService.run', () => {
  it('всё ок — обновляет снимок для /health и /stats, не шлёт DM', async () => {
    mockedBuildProbes.mockReturnValue([okProbe('db')]);
    const { service } = makeService();
    await service.run('test');
    expect(selfCheckState.get().results).toEqual([
      {
        id: 'db',
        title: 'Проба db',
        ok: true,
        detail: 'ок',
        reportInHealth: true,
      },
    ]);
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('есть упавшая проба — DM со списком, снимок отражает провал', async () => {
    mockedBuildProbes.mockReturnValue([
      okProbe('db'),
      failProbe('caldav', 'обнаружение пусто'),
    ]);
    const { service } = makeService();
    await service.run('test');
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('обнаружение пусто');
    expect(
      selfCheckState
        .get()
        .results.filter((r) => !r.ok)
        .map((r) => r.id),
    ).toEqual(['caldav']);
  });

  it('повторный прогон с той же упавшей пробой — снимок обновляется, но DM не дублируется', async () => {
    mockedBuildProbes.mockReturnValue([failProbe('caldav')]);
    const { service } = makeService();
    await service.run('test');
    await service.run('test');
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('Проба caldav: сломано');
    expect(selfCheckState.get().results.map((r) => r.ok)).toEqual([false]);
  });
});

// Инцидент 2026-11-07: каждый деплой присылал тот же DM заново — память
// процесса терялась. Новый процесс = новый сервис и пустой трекер, база общая.
describe('SelfCheckService.run — дедуп DM через рестарт', () => {
  it('рестарт с тем же красным — без второго DM; зелёный — «снова зелёная» и строки удалены', async () => {
    mockedBuildProbes.mockReturnValue([failProbe('ciRuns')]);
    const rows: LeaseRows = new Map();
    await makeService(undefined, rows).service.run('post-deploy');
    selfCheckAlerts.reset(); // новый процесс — память пуста
    await makeService(undefined, rows).service.run('post-deploy');
    expect(mockedNotify).toHaveBeenCalledTimes(1);

    mockedBuildProbes.mockReturnValue([okProbe('ciRuns')]);
    selfCheckAlerts.reset();
    await makeService(undefined, rows).service.run('hourly');
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    expect(mockedNotify.mock.calls[1][0]).toContain('снова зелёная');
    expect(rows.size).toBe(0);
  });

  it('база недоступна — DM решает память процесса, алерт не теряется', async () => {
    mockedBuildProbes.mockReturnValue([failProbe('db', 'не отвечает')]);
    const prisma = {} as unknown as PrismaService;
    const cronLeader = {
      claimRunOrThrow: jest.fn().mockRejectedValue(new Error('P1001')),
    } as unknown as CronLeaderService;
    const service = new SelfCheckService(prisma, cronLeader);
    await service.run('hourly');
    await service.run('hourly');
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('Проба db: не отвечает');
  });
});

describe('SelfCheckService.hourly', () => {
  it('claimRun вернул false — тик пропущен, пробы не гоняются', async () => {
    mockedBuildProbes.mockReturnValue([okProbe('db')]);
    const { service, claimRun } = makeService(
      jest.fn().mockResolvedValue(false),
    );
    await service.hourly();
    expect(claimRun).toHaveBeenCalledWith(
      'selfCheckHourly',
      expect.any(Number),
    );
    expect(mockedBuildProbes).not.toHaveBeenCalled();
  });

  it('claimRun вернул true — прогоняет пробы', async () => {
    mockedBuildProbes.mockReturnValue([okProbe('db')]);
    const { service } = makeService(jest.fn().mockResolvedValue(true));
    await service.hourly();
    expect(mockedBuildProbes).toHaveBeenCalledTimes(1);
    expect(selfCheckState.get().results).toEqual([
      expect.objectContaining({ id: 'db', ok: true }),
    ]);
  });
});

describe('SelfCheckService.onApplicationBootstrap', () => {
  it('запускает прогон через ~60с после старта, без leader-election', () => {
    jest.useFakeTimers();
    try {
      mockedBuildProbes.mockReturnValue([okProbe('db')]);
      const { service, claimRun } = makeService();
      const runSpy = jest.spyOn(service, 'run');
      service.onApplicationBootstrap();
      expect(runSpy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(60_000);
      expect(runSpy).toHaveBeenCalledWith('post-deploy');
      expect(claimRun).not.toHaveBeenCalled(); // именно ЭТОТ триггер без аренды
    } finally {
      jest.useRealTimers();
    }
  });
});
