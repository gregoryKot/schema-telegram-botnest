import { AnalyticsService } from './analytics.service';
import type { AnalyticsEventName } from './analytics.constants';

function makePrisma(create: jest.Mock) {
  return { analyticsEvent: { create } } as never;
}

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

  it('неизвестное имя не пишется (defence in depth)', async () => {
    const create = jest.fn(async () => ({ id: 1 }));
    const service = new AnalyticsService(makePrisma(create));

    await service.track(uid, 'totally_unknown' as AnalyticsEventName, {});

    expect(create).not.toHaveBeenCalled();
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
