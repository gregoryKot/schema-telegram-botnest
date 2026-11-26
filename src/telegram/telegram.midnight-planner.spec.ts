// Полуночный обход (MidnightPlanner): остановка процесса посреди цикла,
// отметка завершения и доделка после рестарта. Аудит 2026-10: деплой посреди
// обхода оставлял хвост пользователей без напоминаний на сутки, а проба
// аренд видела «свежо». Шов с живой базой — test/midnight-planner-resume.e2e-spec.ts.
import { MidnightPlanner } from './telegram.midnight-planner';
import {
  catchUpClaimWindowMs,
  RESUME_WINDOW_MS,
} from './telegram.midnight-lease';
import { LEASE_WINDOW } from '../infra/cron-leader.service';

const RUN_AT = new Date('2026-10-22T00:00:00Z');
const START = new Date('2026-10-22T10:00:00Z');

function make(
  opts: {
    users?: { id: bigint }[];
    planDay?: jest.Mock;
    unfinishedRun?: Date | null;
    usersError?: Error;
    claimRun?: boolean;
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
    claimRun: jest.fn().mockResolvedValue(opts.claimRun ?? true),
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

  it('отметка завершения не записалась (пул закрыт после последнего человека) — warn, не reject', async () => {
    const { mp, leases, logger } = make();
    leases.finishRun.mockRejectedValue(new Error('pool closed'));
    await expect(mp.run(RUN_AT)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Midnight planner: отметка завершения не записалась: pool closed',
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenLastCalledWith(
      'Midnight planner: обработано 3 из 3, ошибок 0',
    );
  });

  it('список пользователей не загрузился — прогон не отмечен завершённым (его увидит проба)', async () => {
    const { mp, leases } = make({ usersError: new Error('db down') });
    await expect(mp.run(RUN_AT)).rejects.toThrow('db down');
    expect(leases.finishRun).not.toHaveBeenCalled();
  });
});

describe('MidnightPlanner.catchUp', () => {
  it('есть оборванный прогон — доделывает его, новую аренду не берёт', async () => {
    const { mp, users, planner, leases } = make({ unfinishedRun: RUN_AT });
    await mp.catchUp(START);
    expect(leases.unfinishedRun).toHaveBeenCalledWith(
      'midnightPlanner',
      RESUME_WINDOW_MS,
    );
    expect(planner.planDay.mock.calls).toEqual(users.map((u) => [u, RUN_AT]));
    expect(leases.claimRun).not.toHaveBeenCalled();
  });

  it('доделывать нечего — захватывает пропущенную полночь и обходит с моментом старта', async () => {
    const { mp, users, planner, leases } = make({ unfinishedRun: null });
    await mp.catchUp(START);
    expect(leases.claimRun).toHaveBeenCalledWith(
      'midnightPlanner',
      catchUpClaimWindowMs(START),
      START,
    );
    expect(planner.planDay.mock.calls).toEqual(users.map((u) => [u, START]));
    expect(leases.finishRun).toHaveBeenCalledWith('midnightPlanner', START);
  });

  it('обход этих суток уже был (захват отклонён) — не обходит', async () => {
    const { mp, planner, logger } = make({ claimRun: false });
    await mp.catchUp(START);
    expect(planner.planDay).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'Midnight planner: при старте обход не нужен',
    );
  });

  it('до 00:00 UTC меньше часа — не захватывает: обход сделает тик', async () => {
    const { mp, planner, leases, logger } = make();
    await mp.catchUp(new Date('2026-10-22T23:30:00Z'));
    expect(leases.claimRun).not.toHaveBeenCalled();
    expect(planner.planDay).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'Midnight planner: при старте обход не нужен',
    );
  });

  it('сбой при старте — warn, не reject и не error (админа не будим)', async () => {
    const { mp, logger } = make({
      unfinishedRun: RUN_AT,
      usersError: new Error('db down'),
    });
    await expect(mp.catchUp(START)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Startup planner catch-up failed (non-critical, retries at midnight): db down',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  // Старт в 23:59:3x: тик 00:00 начал обход раньше, чем выстрелил таймер
  // старта, и доделка увидела бы свежий незавершённый runAt своего же обхода.
  it('обход уже идёт в этом процессе — доделка не запускает второй параллельно', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const planDay = jest.fn(() => gate);
    const { mp, leases, logger } = make({ planDay, unfinishedRun: RUN_AT });
    const tick = mp.run(RUN_AT);
    await Promise.resolve();
    await mp.catchUp(START);
    expect(leases.unfinishedRun).not.toHaveBeenCalled();
    expect(leases.claimRun).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'Midnight planner: обход уже идёт, доделка при старте не нужна',
    );
    release();
    await tick;
    expect(planDay.mock.calls.length).toBe(3);
    // Обход закончился — следующий старт снова смотрит на аренду.
    await mp.catchUp(START);
    expect(leases.unfinishedRun).toHaveBeenCalledWith(
      'midnightPlanner',
      RESUME_WINDOW_MS,
    );
  });

  it('окно доделки короче окна аренды: поздняя доделка не ставит напоминание вплотную к завтрашнему', () => {
    expect(RESUME_WINDOW_MS).toBe(6 * 3_600_000);
    expect(RESUME_WINDOW_MS).toBeLessThan(LEASE_WINDOW.daily);
  });
});
