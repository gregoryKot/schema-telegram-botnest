// Агрегат денег: groupBy по статусу для донатов/подписки/висящих сессий, count
// по paidAt для оплаченных сессий, окна 7 дней и всё время. Prisma мокается
// (образец — account-link-metrics.service.spec.ts); шов с настоящими бронями
// на живой БД — test/booking-paid-page.e2e-spec.ts.
import { PAID_AT_TRACKED_SINCE } from '../booking/booking-paid-at';
import { formatMoneyMetrics } from './money-metrics.format';
import { MoneyMetricsService } from './money-metrics.service';

describe('MoneyMetricsService.getMetrics', () => {
  type Rows = Array<Record<string, unknown>>;
  const build = (
    calls: {
      donation7: Rows;
      charge7: Rows;
      booking7: Rows;
      donationAll: Rows;
      chargeAll: Rows;
      bookingAll: Rows;
    },
    { withoutLink = 0, paid7 = 0, paidAll = 0 } = {},
  ) => {
    // window() запускает три groupBy и count оплаченных параллельно, дважды —
    // сначала за 7 дней (this.window(since7)), потом за всё время
    // (this.window(undefined)) — тоже через общий Promise.all в getMetrics().
    // Порядок промисов в этом Promise.all([this.window(since7), this.window(undefined)])
    // не гарантирует порядок СТАРТА внутренних groupBy между двумя вызовами
    // window(), но jest.fn() с mockResolvedValueOnce отдаёт по очереди
    // вызовов — поэтому очередь ровно: [donation7, charge7, booking7,
    // donationAll, chargeAll, bookingAll].
    const donationGroupBy = jest
      .fn()
      .mockResolvedValueOnce(calls.donation7)
      .mockResolvedValueOnce(calls.donationAll);
    const chargeGroupBy = jest
      .fn()
      .mockResolvedValueOnce(calls.charge7)
      .mockResolvedValueOnce(calls.chargeAll);
    const bookingGroupBy = jest
      .fn()
      .mockResolvedValueOnce(calls.booking7)
      .mockResolvedValueOnce(calls.bookingAll);
    // count зовут трое: оплаченные за неделю, оплаченные за всё время и
    // «застрявшие без ссылки». Различаем по where, а не по порядку вызовов.
    const bookingCount = jest.fn(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (!('OR' in where)) return withoutLink;
        const [byPaidAt] = where.OR as Array<{
          paidAt: Record<string, unknown>;
        }>;
        return 'gte' in byPaidAt.paidAt ? paid7 : paidAll;
      },
    );
    const prisma = {
      donation: { groupBy: donationGroupBy },
      subscriptionCharge: { groupBy: chargeGroupBy },
      booking: { groupBy: bookingGroupBy, count: bookingCount },
    } as never;
    return {
      service: new MoneyMetricsService(prisma),
      donationGroupBy,
      chargeGroupBy,
      bookingGroupBy,
      bookingCount,
    };
  };

  const EMPTY: Record<string, never>[] = [];

  it('пустая база — все нули, без NaN/undefined', async () => {
    const { service } = build({
      donation7: EMPTY,
      charge7: EMPTY,
      booking7: EMPTY,
      donationAll: EMPTY,
      chargeAll: EMPTY,
      bookingAll: EMPTY,
    });

    await expect(service.getMetrics()).resolves.toEqual({
      week: {
        donations: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        paidSessions: 0,
        pendingSessions: 0,
      },
      allTime: {
        donations: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        subscriptions: { paidCount: 0, paidSum: 0, pendingCount: 0 },
        paidSessions: 0,
        pendingSessions: 0,
      },
    });
  });

  it('раскладывает paid/pending по донатам, подписке и сессиям', async () => {
    const donationRows = [
      { status: 'paid', _count: { _all: 3 }, _sum: { amount: 1500 } },
      { status: 'pending', _count: { _all: 1 }, _sum: { amount: 500 } },
    ];
    const chargeRows = [
      { status: 'paid', _count: { _all: 2 }, _sum: { amount: 600 } },
    ];
    const bookingRows = [
      { status: 'CONFIRMED', _count: { _all: 4 } },
      { status: 'COMPLETED', _count: { _all: 1 } },
      { status: 'HELD', _count: { _all: 2 } },
      { status: 'CANCELLED', _count: { _all: 9 } },
    ];
    const { service } = build(
      {
        donation7: donationRows,
        charge7: chargeRows,
        booking7: bookingRows,
        donationAll: donationRows,
        chargeAll: chargeRows,
        bookingAll: bookingRows,
      },
      { paid7: 5, paidAll: 8 },
    );

    const m = await service.getMetrics();

    expect(m.week.donations).toEqual({
      paidCount: 3,
      paidSum: 1500,
      pendingCount: 1,
    });
    expect(m.week.subscriptions).toEqual({
      paidCount: 2,
      paidSum: 600,
      pendingCount: 0,
    });
    // Оплаченные — из count по paidAt (окно неделя / всё время), а не из
    // статусов groupBy: CONFIRMED (4) + COMPLETED (1) их не определяют.
    expect(m.week.paidSessions).toBe(5);
    expect(m.allTime.paidSessions).toBe(8);
    // Висит неоплаченным — по-прежнему HELD из groupBy; CANCELLED не в счёте.
    expect(m.week.pendingSessions).toBe(2);
  });

  it('три бесплатных знакомства (CONFIRMED) не делают «оплатили сессию» — регрессия аудита 2026-10-11', async () => {
    // До починки paidSessions брался из groupBy по статусу: 3 знакомства
    // INTRO_15 (сразу CONFIRMED) читались как «Оплатили сессию: 3 раза».
    const intros = [{ status: 'CONFIRMED', _count: { _all: 3 } }];
    const { service } = build({
      donation7: EMPTY,
      charge7: EMPTY,
      booking7: intros,
      donationAll: EMPTY,
      chargeAll: EMPTY,
      bookingAll: intros,
    });

    const m = await service.getMetrics();

    expect([m.week.paidSessions, m.allTime.paidSessions]).toEqual([0, 0]);
    expect(formatMoneyMetrics(m)).not.toContain('Оплатили сессию');
  });

  it('оплаченные сессии считаются по paidAt: неделя — по дате оплаты, всё время — без окна', async () => {
    const { service, bookingCount } = build({
      donation7: EMPTY,
      charge7: EMPTY,
      booking7: EMPTY,
      donationAll: EMPTY,
      chargeAll: EMPTY,
      bookingAll: EMPTY,
    });
    await service.getMetrics();

    const wheres = bookingCount.mock.calls.map(([a]) => a.where);
    expect(wheres).toHaveLength(2);
    const [week, all] = wheres as Array<{ OR: Array<Record<string, unknown>> }>;
    expect(week.OR[0].paidAt).toEqual({ gte: expect.any(Date) });
    expect(all.OR[0].paidAt).toEqual({ not: null });
    expect(week.OR[1].createdAt).toEqual({
      gte: expect.any(Date),
      lt: PAID_AT_TRACKED_SINCE,
    });
    expect(all.OR[1].createdAt).toEqual({ lt: PAID_AT_TRACKED_SINCE });
  });

  it('7-дневное окно фильтрует по createdAt, all-time — нет', async () => {
    const { service, donationGroupBy } = build({
      donation7: EMPTY,
      charge7: EMPTY,
      booking7: EMPTY,
      donationAll: EMPTY,
      chargeAll: EMPTY,
      bookingAll: EMPTY,
    });
    await service.getMetrics();

    const [weekArgs, allTimeArgs] = donationGroupBy.mock.calls;
    expect((weekArgs[0] as { where?: unknown }).where).toEqual(
      expect.objectContaining({
        createdAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    );
    expect((allTimeArgs[0] as { where?: unknown }).where).toBeUndefined();
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const donationRows = [
      { status: 'paid', _count: { _all: 3 }, _sum: { amount: 1500 } },
    ];
    const { service } = build({
      donation7: donationRows,
      charge7: EMPTY,
      booking7: EMPTY,
      donationAll: donationRows,
      chargeAll: EMPTY,
      bookingAll: EMPTY,
    });

    await expect(service.render()).resolves.toContain(
      'Поддержали проект: 3 раза на 1500 ₽',
    );
  });

  it('render() подклеивает строку про подтверждённые записи, где ещё не готовы ссылка или календарь', async () => {
    const { service, bookingCount } = build(
      {
        donation7: EMPTY,
        charge7: EMPTY,
        booking7: EMPTY,
        donationAll: EMPTY,
        chargeAll: EMPTY,
        bookingAll: EMPTY,
      },
      { withoutLink: 2 },
    );

    await expect(service.render()).resolves.toContain(
      'Подтверждённых записей, где ещё не готовы ссылка или календарь: 2',
    );
    const stuckCalls = bookingCount.mock.calls.filter(
      ([a]) => 'confirmEffectsDoneAt' in a.where,
    );
    expect(stuckCalls).toHaveLength(1);
  });
});
