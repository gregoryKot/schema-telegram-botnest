// Агрегат «сессии не в рублях»: Prisma groupBy по currency (не сырой SQL),
// окна 7 дней и всё время. Prisma мокается; шов с живой БД — /stats в
// test/raw-sql-live-stats.e2e-spec.ts.
import { BookingStatus, SessionType } from '@prisma/client';
import { SessionCurrencyMetricsService } from './session-currency-metrics.service';

type Row = { currency: string; _count: { _all: number } };

function build(rows: { week: Row[]; all: Row[] }) {
  const groupBy = jest
    .fn()
    .mockResolvedValueOnce(rows.week)
    .mockResolvedValueOnce(rows.all);
  const service = new SessionCurrencyMetricsService({
    booking: { groupBy },
  } as never);
  return { service, groupBy };
}
const row = (currency: string, n: number): Row => ({
  currency,
  _count: { _all: n },
});

describe('SessionCurrencyMetricsService', () => {
  const NOW = new Date('2026-10-20T12:00:00Z');

  it('группирует по валюте, раскладывает окна неделя / всё время', async () => {
    const { service } = build({
      week: [row('ILS', 1), row('USD', 1)],
      all: [row('ILS', 3), row('EUR', 1), row('USD', 1)],
    });
    expect(await service.getMetrics(NOW)).toEqual({
      week: { ILS: 1, USD: 1 },
      allTime: { ILS: 3, EUR: 1, USD: 1 },
    });
  });

  it('запрос: только платные, не рубли, подтверждённые или проведённые; неделя — по createdAt', async () => {
    const { service, groupBy } = build({ week: [], all: [] });
    await service.getMetrics(NOW);
    const weekWhere = groupBy.mock.calls[0][0].where;
    const allWhere = groupBy.mock.calls[1][0].where;
    expect(groupBy.mock.calls[0][0].by).toEqual(['currency']);
    for (const where of [weekWhere, allWhere]) {
      expect(where.type).toEqual({ not: SessionType.INTRO_15 });
      expect(where.currency).toEqual({ not: 'RUB' });
      expect(where.status).toEqual({
        in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
      });
    }
    expect(weekWhere.createdAt).toEqual({
      gte: new Date(NOW.getTime() - 7 * 86_400_000),
    });
    expect(allWhere.createdAt).toBeUndefined();
  });

  it('неизвестная валюта в строке не попадает в счётчики', async () => {
    const { service } = build({
      week: [row('XXX', 4)],
      all: [row('XXX', 4), row('EUR', 2)],
    });
    expect(await service.getMetrics(NOW)).toEqual({
      week: {},
      allTime: { EUR: 2 },
    });
  });

  it('пустая база: render() — одна строка «Пока таких сессий не было», без NaN', async () => {
    const { service } = build({ week: [], all: [] });
    const text = await service.render();
    expect(text).toContain('Пока таких сессий не было.');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('render() с данными — готовый блок для /stats', async () => {
    const { service } = build({ week: [row('USD', 1)], all: [row('USD', 2)] });
    const text = await service.render();
    expect(text).toContain('За 7 дней: 1 (1 в долларах)');
    expect(text).toContain('За всё время: 2 (2 в долларах)');
  });
});
