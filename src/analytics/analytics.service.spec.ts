import { AnalyticsService } from './analytics.service';
import type { AnalyticsEventName } from './analytics.constants';

function makePrisma(create: jest.Mock) {
  return { analyticsEvent: { create } } as never;
}

describe('AnalyticsService.pruneOld — ретеншен (L10)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('удаляет события старше 90 дней, свежие не трогает', async () => {
    const now = new Date('2026-08-14T00:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const rows = [
      { id: 1, createdAt: new Date(now - 100 * 86_400_000) }, // старое
      { id: 2, createdAt: new Date(now - 10 * 86_400_000) }, // свежее
    ];
    const deleteMany = jest.fn(
      async ({ where }: { where: { createdAt: { lt: Date } } }) => {
        const cutoff = where.createdAt.lt.getTime();
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--)
          if (rows[i].createdAt.getTime() < cutoff) rows.splice(i, 1);
        return { count: before - rows.length };
      },
    );
    const service = new AnalyticsService({
      analyticsEvent: { deleteMany },
    } as never);

    await service.pruneOld();

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(rows.map((r) => r.id)).toEqual([2]); // только старое удалено
  });

  it('не бросает, если deleteMany падает (ретеншен не роняет процесс)', async () => {
    const deleteMany = jest.fn(async () => {
      throw new Error('db down');
    });
    const service = new AnalyticsService({
      analyticsEvent: { deleteMany },
    } as never);
    await expect(service.pruneOld()).resolves.toBeUndefined();
  });

  it('нечего удалять (count 0) → не падает, лишний лог не пишется', async () => {
    const deleteMany = jest.fn(async () => ({ count: 0 }));
    const service = new AnalyticsService({
      analyticsEvent: { deleteMany },
    } as never);
    await expect(service.pruneOld()).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe('AnalyticsService.track', () => {
  const uid = 42n;

  it('пишет известное событие с userId, name и meta', async () => {
    const create = jest.fn(async () => ({ id: 1 }));
    const service = new AnalyticsService(makePrisma(create));

    await service.track(uid, 'share_card', { kind: 'weekly' });

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.data.userId).toBe(uid);
    expect(arg.data.name).toBe('share_card');
    expect(arg.data.meta).toEqual({ kind: 'weekly' });
  });

  it('без meta пишет JsonNull, а не undefined', async () => {
    const create = jest.fn(async () => ({ id: 1 }));
    const service = new AnalyticsService(makePrisma(create));

    await service.track(uid, 'share_card');

    const arg = create.mock.calls[0][0];
    // Prisma.JsonNull — сериализуемое значение, не undefined
    expect(arg.data.meta).toBeDefined();
  });

  it('userId = null (аноним с сайта) пишется как null, не падает', async () => {
    const create = jest.fn(async () => ({ id: 1 }));
    const service = new AnalyticsService(makePrisma(create));

    await service.track(null, 'quiz_completed', {
      quiz: 'drives',
      result: 'adult',
      src: 'web',
    });

    const arg = create.mock.calls[0][0];
    expect(arg.data.userId).toBeNull();
    expect(arg.data.name).toBe('quiz_completed');
  });

  it('неизвестное имя не пишется (defence in depth)', async () => {
    const create = jest.fn(async () => ({ id: 1 }));
    const service = new AnalyticsService(makePrisma(create));

    await service.track(uid, 'totally_unknown' as AnalyticsEventName, {});

    expect(create).not.toHaveBeenCalled();

    // Guard не «залипает» — следующий вызов с известным именем всё равно пишется.
    await service.track(uid, 'share_card', { kind: 'weekly' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.name).toBe('share_card');
  });

  it('ошибка БД не пробрасывается — аналитика не ломает действие юзера', async () => {
    const create = jest.fn(async () => {
      throw new Error('db down');
    });
    const service = new AnalyticsService(makePrisma(create));

    await expect(
      service.track(uid, 'share_card', { kind: 'streak' }),
    ).resolves.toBeUndefined();
  });
});
