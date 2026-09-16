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
    critical: false,
    run: async () => ({ ok: true, detail: 'ок' }),
  };
}
function failProbe(id: string, detail = 'сломано'): Probe {
  return {
    id,
    title: `Проба ${id}`,
    critical: false,
    run: async () => ({ ok: false, detail }),
  };
}

function makeService(claimRun: jest.Mock = jest.fn().mockResolvedValue(true)) {
  const prisma = {} as unknown as PrismaService;
  const cronLeader = { claimRun } as unknown as CronLeaderService;
  return { service: new SelfCheckService(prisma, cronLeader), claimRun };
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
      { id: 'db', title: 'Проба db', critical: false, ok: true, detail: 'ок' },
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
