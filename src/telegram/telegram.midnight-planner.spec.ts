// Полуночный обход (MidnightPlanner): остановка процесса посреди цикла,
// отметка завершения и доделка после рестарта. Аудит 2026-10: деплой посреди
// обхода оставлял хвост пользователей без напоминаний на сутки, а проба
// аренд видела «свежо». Шов с живой базой — test/midnight-planner-resume.e2e-spec.ts.
import { MidnightPlanner } from './telegram.midnight-planner';
import { LEASE_WINDOW } from '../infra/cron-leader.service';

const RUN_AT = new Date('2026-10-22T00:00:00Z');

function make(
  opts: {
    users?: { id: bigint }[];
    planDay?: jest.Mock;
    unfinishedRun?: Date | null;
    usersError?: Error;
  } = {},
) {
  const users = opts.users ?? [{ id: 1n }, { id: 2n }, { id: 3n }];
  const accounts = {
    getAllUsersWithSettings: opts.usersError
      ? jest.fn().mockRejectedValue(opts.usersError)
      : jest.fn().mockResolvedValue(users),
  };
  const planner = {
    planDay: opts.planDay ?? jest.fn().mockResolvedValue(undefined),
  };
  const leases = {
    finishRun: jest.fn().mockResolvedValue(undefined),
    unfinishedRun: jest.fn().mockResolvedValue(opts.unfinishedRun ?? null),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const mp = new MidnightPlanner(accounts, planner, leases, logger);
  return { mp, users, planner, leases, logger };
}

describe('MidnightPlanner.run', () => {
  it('проходит всех, отмечает завершение тем же runAt и пишет «M из N»', async () => {
    const { mp, users, planner, leases, logger } = make();
    await mp.run(RUN_AT);
    expect(planner.planDay.mock.calls).toEqual(users.map((u) => [u, RUN_AT]));
    expect(leases.finishRun).toHaveBeenCalledWith('midnightPlanner', RUN_AT);
    expect(logger.log).toHaveBeenLastCalledWith(
      'Midnight planner: обработано 3 из 3, ошибок 0',
    );
  });

  it('ошибка одного человека не рвёт цикл и не мешает отметке завершения', async () => {
    const planDay = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const { mp, users, leases, logger } = make({ planDay });
    await mp.run(RUN_AT);
    expect(planDay.mock.calls.map((c) => c[0])).toEqual(users);
    expect(logger.error).toHaveBeenCalledWith(
      'Midnight planner failed for userId=2',
      expect.any(Error),
    );
    expect(leases.finishRun).toHaveBeenCalledWith('midnightPlanner', RUN_AT);
    expect(logger.log).toHaveBeenLastCalledWith(
      'Midnight planner: обработано 3 из 3, ошибок 1',
    );
  });

  it('остановка процесса посреди цикла: выход без отметки, warn «M из N», без error', async () => {
    const ref: { mp?: MidnightPlanner } = {};
    const planDay = jest.fn(() => {
      if (planDay.mock.calls.length === 2) ref.mp?.stop();
      return Promise.resolve();
    });
    const built = make({ planDay });
    ref.mp = built.mp;
    await built.mp.run(RUN_AT);
    expect(planDay).toHaveBeenCalledTimes(2);
    expect(built.leases.finishRun).not.toHaveBeenCalled();
    expect(built.logger.warn).toHaveBeenCalledWith(
      'Midnight planner прерван остановкой процесса: обработано 2 из 3, остаток доделает следующий старт',
    );
    expect(built.logger.error).not.toHaveBeenCalled();
  });

  it('список пользователей не загрузился — прогон не отмечен завершённым (его увидит проба)', async () => {
    const { mp, leases } = make({ usersError: new Error('db down') });
    await expect(mp.run(RUN_AT)).rejects.toThrow('db down');
    expect(leases.finishRun).not.toHaveBeenCalled();
  });
});

describe('MidnightPlanner.catchUp', () => {
  it('есть оборванный прогон — доделывает его, claimAndRun не зовёт', async () => {
    const { mp, users, planner, leases } = make({ unfinishedRun: RUN_AT });
    const claimAndRun = jest.fn().mockResolvedValue(undefined);
    await mp.catchUp(claimAndRun);
    expect(leases.unfinishedRun).toHaveBeenCalledWith(
      'midnightPlanner',
      LEASE_WINDOW.daily,
    );
    expect(planner.planDay.mock.calls).toEqual(users.map((u) => [u, RUN_AT]));
    expect(claimAndRun).not.toHaveBeenCalled();
  });

  it('доделывать нечего — передаёт ход claimAndRun (пропущенная полночь)', async () => {
    const { mp, planner } = make({ unfinishedRun: null });
    const claimAndRun = jest.fn().mockResolvedValue(undefined);
    await mp.catchUp(claimAndRun);
    expect(claimAndRun).toHaveBeenCalledTimes(1);
    expect(planner.planDay.mock.calls).toEqual([]);
  });

  it('сбой при старте — warn, не reject и не error (админа не будим)', async () => {
    const { mp, logger } = make({
      unfinishedRun: RUN_AT,
      usersError: new Error('db down'),
    });
    await expect(mp.catchUp(jest.fn())).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Startup planner catch-up failed (non-critical, retries at midnight): db down',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
