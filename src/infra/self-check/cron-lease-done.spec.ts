// Правило «прогон захвачен, но не дошёл до конца» пробы cronLeases.
import {
  COMPLETING_LEASES,
  UNFINISHED_GRACE_MS,
  unfinishedRunProblem,
} from './cron-lease-done';

const RUN = new Date('2026-10-18T00:00:00Z').getTime();
const H = 3_600_000;
const LONG_AGO = RUN - 48 * H;

describe('unfinishedRunProblem', () => {
  it('сейчас судится только midnightPlanner', () => {
    expect([...COMPLETING_LEASES]).toEqual(['midnightPlanner']);
  });

  it('не завершён дольше двух часов — строка с временем начала', () => {
    expect(
      unfinishedRunProblem('midnightPlanner', {
        runAt: RUN,
        now: RUN + UNFINISHED_GRACE_MS + 1,
        startedAt: LONG_AGO,
      }),
    ).toBe(
      'обход, начатый в 00:00 UTC, не дошёл до конца — часть людей осталась без запланированных сообщений',
    );
  });

  it('отметка от прошлого прогона (doneRunAt ≠ runAt) — тоже не завершён', () => {
    expect(
      unfinishedRunProblem('midnightPlanner', {
        runAt: RUN,
        doneRunAt: RUN - 24 * H,
        now: RUN + 3 * H,
        startedAt: LONG_AGO,
      }),
    ).not.toBeNull();
  });

  it('ровно два часа — ещё в пределах запаса', () => {
    expect(
      unfinishedRunProblem('midnightPlanner', {
        runAt: RUN,
        now: RUN + UNFINISHED_GRACE_MS,
        startedAt: LONG_AGO,
      }),
    ).toBeNull();
  });

  it('завершён тем же runAt — в порядке', () => {
    expect(
      unfinishedRunProblem('midnightPlanner', {
        runAt: RUN,
        doneRunAt: RUN,
        now: RUN + 12 * H,
        startedAt: LONG_AGO,
      }),
    ).toBeNull();
  });

  it('процесс поднялся после начала прогона — два часа отсчитываются от старта', () => {
    const facts = { runAt: RUN, startedAt: RUN + 10 * H };
    expect(
      unfinishedRunProblem('midnightPlanner', {
        ...facts,
        now: facts.startedAt + UNFINISHED_GRACE_MS,
      }),
    ).toBeNull();
    expect(
      unfinishedRunProblem('midnightPlanner', {
        ...facts,
        now: facts.startedAt + UNFINISHED_GRACE_MS + 1,
      }),
    ).not.toBeNull();
  });

  it('аренда без отметки завершения (не из COMPLETING_LEASES) на doneRunAt не смотрится', () => {
    expect(
      unfinishedRunProblem('notificationQueue', {
        runAt: RUN,
        now: RUN + 12 * H,
        startedAt: LONG_AGO,
      }),
    ).toBeNull();
  });

  it('строки аренды нет — судить нечего (это забота правила тиков)', () => {
    expect(
      unfinishedRunProblem('midnightPlanner', {
        now: RUN + 12 * H,
        startedAt: LONG_AGO,
      }),
    ).toBeNull();
  });
});
