import { AnalyticsService } from './analytics.service';
import type { AnalyticsEventName } from './analytics.constants';
import { KEPT_UNTIL_ACCOUNT_DELETION } from './analytics-retention';

function makePrisma(create: jest.Mock) {
  return { analyticsEvent: { create } } as never;
}

describe('AnalyticsService.pruneOld — ретеншен (L10)', () => {
  afterEach(() => jest.restoreAllMocks());

  // Фейк повторяет фильтр pruneOld: createdAt < cutoff и name вне notIn.
  type PruneWhere = { createdAt: { lt: Date }; name?: { notIn: string[] } };
  function fakeTable(
    rows: Array<{ id: number; name: string; createdAt: Date }>,
  ) {
    return jest.fn(async ({ where }: { where: PruneWhere }) => {
      const cutoff = where.createdAt.lt.getTime();
      const kept = where.name?.notIn ?? [];
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--)
        if (
          rows[i].createdAt.getTime() < cutoff &&
          !kept.includes(rows[i].name)
        )
          rows.splice(i, 1);
      return { count: before - rows.length };
    });
  }

  it('удаляет события старше 90 дней, свежие не трогает', async () => {
    const now = new Date('2026-08-14T00:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const rows = [
      {
        id: 1,
        name: 'share_card',
        createdAt: new Date(now - 100 * 86_400_000),
      }, // старое
      { id: 2, name: 'share_card', createdAt: new Date(now - 10 * 86_400_000) }, // свежее
    ];
    const deleteMany = fakeTable(rows);
    const service = new AnalyticsService({
      analyticsEvent: { deleteMany },
    } as never);

    await service.pruneOld();

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(rows.map((r) => r.id)).toEqual([2]); // только старое удалено
  });

  // Решение владельца (аудит 2026-10): след «человек забрал свои данные»
  // хранится до удаления аккаунта, а не 90 дней.
  it('data_export старше 90 дней остаётся, соседнее старое событие удаляется', async () => {
    const now = new Date('2026-08-14T00:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const old = new Date(now - 400 * 86_400_000);
    const rows = [
      { id: 1, name: 'data_export', createdAt: old },
      { id: 2, name: 'share_card', createdAt: old },
    ];
    const deleteMany = fakeTable(rows);
    const service = new AnalyticsService({
      analyticsEvent: { deleteMany },
    } as never);

    await service.pruneOld();

    expect(KEPT_UNTIL_ACCOUNT_DELETION).toContain('data_export');
    expect(rows.map((r) => r.id)).toEqual([1]);
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

  // D4 (аудит 2026-10): «человек X увидел кризисную карточку» — маркер
  // суицидальных мыслей, привязанный к личности. /stats нужны только счётчики.
  it.each(['crisis_card_shown', 'crisis_hotline_tapped'] as const)(
    '%s пишется с userId = null, даже если вызывающий передал uid',
    async (name) => {
      const create = jest.fn(async () => ({ id: 1 }));
      const service = new AnalyticsService(makePrisma(create));

      await service.track(uid, name, { surface: 'note' });

      const arg = create.mock.calls[0][0];
      expect(arg.data.userId).toBeNull();
      expect(arg.data.name).toBe(name);
      expect(arg.data.meta).toEqual({ surface: 'note' });
    },
  );

  it('остальные события сохраняют userId (контрольный случай для D4)', async () => {
    const create = jest.fn(async () => ({ id: 1 }));
    const service = new AnalyticsService(makePrisma(create));

    await service.track(uid, 'share_result', { kind: 'weekly', ok: true });

    expect(create.mock.calls[0][0].data.userId).toBe(uid);
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
