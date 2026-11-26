import { WeeklyRepeatScheduler } from './weekly-repeat.scheduler';

const at = new Date();
function build(opts: {
  claim?: boolean;
  pending?: boolean;
  modes?: unknown[];
  ratings?: unknown[];
  bot?: unknown;
}) {
  const user = {
    findMany: jest
      .fn()
      .mockResolvedValueOnce([{ id: 1n }])
      .mockResolvedValue([]),
  };
  const prisma = {
    user,
    modeDiaryEntry: { findMany: jest.fn().mockResolvedValue(opts.modes ?? []) },
    rating: { findMany: jest.fn().mockResolvedValue(opts.ratings ?? []) },
  };
  const notifications = {
    hasPending: jest.fn().mockResolvedValue(opts.pending ?? false),
    schedule: jest.fn().mockResolvedValue(undefined),
  };
  const cronLeader = {
    claimRun: jest.fn().mockResolvedValue(opts.claim ?? true),
  };
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const sched = new WeeklyRepeatScheduler(
    prisma as never,
    notifications as never,
    cronLeader as never,
    ('bot' in opts ? opts.bot : {}) as never,
    analytics as never,
  );
  return { sched, prisma, notifications, cronLeader, analytics };
}
const twoModes = [1, 2].map(() => ({
  userId: 1n,
  modeId: 'punitive_critic',
  createdAt: at,
}));

describe('WeeklyRepeatScheduler', () => {
  it('аренду не взяли — ничего не ставит и базу не читает', async () => {
    const t = build({ claim: false, modes: twoModes });
    await t.sched.run();
    expect(t.prisma.user.findMany).not.toHaveBeenCalled();
    expect(t.notifications.schedule).not.toHaveBeenCalled();
  });

  it('без бота аренду не берёт', async () => {
    const t = build({ bot: null });
    await t.sched.run();
    expect(t.cronLeader.claimRun).not.toHaveBeenCalled();
  });

  it('повтор — строка очереди с ключами и событие', async () => {
    const t = build({ modes: twoModes });
    await t.sched.run();
    expect(t.notifications.schedule).toHaveBeenCalledWith(
      1n,
      'weekly_repeat',
      expect.any(Date),
      { kind: 'mode', key: 'punitive_critic', count: 2 },
    );
    expect(t.analytics.track).toHaveBeenCalledWith(1n, 'weekly_repeat_sent', {
      kind: 'mode',
    });
  });

  it('повторов нет — не ставит', async () => {
    const t = build({ modes: [twoModes[0]] });
    await t.sched.run();
    expect(t.notifications.schedule).not.toHaveBeenCalled();
  });

  it('уже есть неотправленное — не ставит второе', async () => {
    const t = build({ modes: twoModes, pending: true });
    await t.sched.run();
    expect(t.notifications.schedule).not.toHaveBeenCalled();
  });
});
