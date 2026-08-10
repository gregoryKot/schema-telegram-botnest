// Агрегат денег: groupBy по статусу для донатов/подписки/сессий, окна
// 7 дней и всё время. Prisma мокается (образец —
// account-link-metrics.service.spec.ts).
import { MoneyMetricsService } from './money-metrics.service';

describe('MoneyMetricsService.getMetrics', () => {
  type Rows = Array<Record<string, unknown>>;
  const build = (calls: {
    donation7: Rows;
    charge7: Rows;
    booking7: Rows;
    donationAll: Rows;
    chargeAll: Rows;
    bookingAll: Rows;
  }) => {
    // window() запускает три groupBy параллельно (Promise.all), дважды —
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
    const prisma = {
      donation: { groupBy: donationGroupBy },
      subscriptionCharge: { groupBy: chargeGroupBy },
      booking: { groupBy: bookingGroupBy },
    } as never;
    return {
      service: new MoneyMetricsService(prisma),
      donationGroupBy,
      chargeGroupBy,
      bookingGroupBy,
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
    const { service } = build({
      donation7: donationRows,
      charge7: chargeRows,
      booking7: bookingRows,
      donationAll: donationRows,
      chargeAll: chargeRows,
      bookingAll: bookingRows,
    });

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
    // CONFIRMED (4) + COMPLETED (1) считаются оплаченными сессиями,
    // CANCELLED — нет (это не «висит неоплаченным», это отменено).
    expect(m.week.paidSessions).toBe(5);
    expect(m.week.pendingSessions).toBe(2);
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
});
