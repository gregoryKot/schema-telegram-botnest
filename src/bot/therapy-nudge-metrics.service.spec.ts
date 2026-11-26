// Агрегат блока «Мост к терапевту»: один findMany meta за 30 дней (фильтр по
// имени и дате — в where) и чистый агрегат в памяти. Мок отдаёт строки, а
// проверка where ловит перепутанное имя события или пропавший срок.
import {
  THERAPY_NUDGE_EVENT,
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';
import { TherapyNudgeMetricsService } from './therapy-nudge-metrics.service';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const MONTH_AGO = new Date('2026-09-27T12:00:00.000Z');

type Args = {
  where: { name: string; createdAt: { gte: Date } };
  select: { meta: true };
};

function build(metas: unknown[] = [], intro = 0, booking = 0) {
  const findMany = jest.fn(async (_args: Args) =>
    metas.map((meta) => ({ meta })),
  );
  const introCount = jest.fn(async () => intro);
  const bookingCount = jest.fn(async () => booking);
  return {
    findMany,
    introCount,
    bookingCount,
    service: new TherapyNudgeMetricsService({
      analyticsEvent: { findMany },
      introLead: { count: introCount },
      booking: { count: bookingCount },
    } as never),
  };
}

describe('TherapyNudgeMetricsService', () => {
  it('пустая БД: все нули, списки полные', async () => {
    const { service } = build();
    const m = await service.getMetrics(NOW);
    expect(m.shownByPlace).toHaveLength(THERAPY_NUDGE_PLACES.length);
    expect(m.signalByTrigger).toHaveLength(THERAPY_NUDGE_TRIGGERS.length);
    expect(m.shownByPlace.every((r) => r.count === 0)).toBe(true);
    expect([
      m.open,
      m.book,
      m.write,
      m.dismiss,
      m.introFromApp,
      m.bookingFromApp,
    ]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('раскладывает счётчики по месту, причине и действию', async () => {
    const { service } = build(
      [
        ...Array.from({ length: 9 }, () => ({
          place: 'home',
          action: 'shown',
        })),
        { place: 'signal_card', action: 'shown', trigger: 'crisis' },
        { place: 'signal_card', action: 'shown', trigger: 'crisis' },
        ...Array.from({ length: 5 }, () => ({ place: 'more', action: 'open' })),
        ...Array.from({ length: 3 }, () => ({ place: 'more', action: 'book' })),
        { place: 'home', action: 'write' },
        ...Array.from({ length: 4 }, () => ({
          place: 'signal_card',
          action: 'dismiss',
        })),
      ],
      6,
      4,
    );
    const m = await service.getMetrics(NOW);
    expect(m.shownByPlace.find((r) => r.place === 'home')?.count).toBe(9);
    expect(m.shownByPlace.find((r) => r.place === 'more')?.count).toBe(0);
    expect(m.signalByTrigger.find((r) => r.trigger === 'crisis')?.count).toBe(
      2,
    );
    expect(m.signalByTrigger.find((r) => r.trigger === 'none')?.count).toBe(0);
    expect([
      m.open,
      m.book,
      m.write,
      m.dismiss,
      m.introFromApp,
      m.bookingFromApp,
    ]).toEqual([5, 3, 1, 4, 6, 4]);
  });

  it('фильтры: окно 30 дней и имя события в where, только meta в select; заявки — source содержит from=app', async () => {
    const { service, findMany, introCount } = build();
    await service.getMetrics(NOW);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { name: THERAPY_NUDGE_EVENT, createdAt: { gte: MONTH_AGO } },
      select: { meta: true },
    });
    expect(introCount).toHaveBeenCalledWith({
      where: {
        createdAt: { gte: MONTH_AGO },
        source: { contains: 'from=app' },
      },
    });
  });

  it('записи на слот: тот же фильтр по source и окну', async () => {
    const { service, bookingCount } = build();
    await service.getMetrics(NOW);
    expect(bookingCount).toHaveBeenCalledWith({
      where: {
        createdAt: { gte: MONTH_AGO },
        source: { contains: 'from=app' },
      },
    });
  });

  it('render() отдаёт текст блока', async () => {
    const { service } = build();
    await expect(service.render()).resolves.toContain('Пока ничего.');
  });
});
