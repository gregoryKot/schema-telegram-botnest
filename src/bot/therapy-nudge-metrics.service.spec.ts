// Агрегат блока «Мост к терапевту»: count по Prisma (JSON-фильтр meta, без
// сырого SQL). Мок отвечает по фильтру, поэтому перепутанный ключ виден.
import {
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';
import { TherapyNudgeMetricsService } from './therapy-nudge-metrics.service';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const MONTH_AGO = new Date('2026-09-27T12:00:00.000Z');

type MetaFilter = { meta: { path: string[]; equals: string } };
type Args = { where: { name: string; AND: MetaFilter[] } };

function fields(args: Args): Record<string, string> {
  return Object.fromEntries(
    args.where.AND.map((f) => [f.meta.path[0], f.meta.equals]),
  );
}

function build(
  answer: (f: Record<string, string>) => number = () => 0,
  intro = 0,
  booking = 0,
) {
  const eventCount = jest.fn(async (args: Args) => answer(fields(args)));
  const introCount = jest.fn(async () => intro);
  const bookingCount = jest.fn(async () => booking);
  return {
    eventCount,
    introCount,
    bookingCount,
    service: new TherapyNudgeMetricsService({
      analyticsEvent: { count: eventCount },
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
      (f) => {
        if (f.trigger === 'crisis') return 2;
        if (f.action === 'shown') return f.place === 'home' ? 9 : 0;
        return { open: 5, book: 3, write: 1, dismiss: 4 }[f.action] ?? 0;
      },
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

  it('фильтры: окно 30 дней, имя события, ключи meta; заявки — source содержит from=app', async () => {
    const { service, eventCount, introCount } = build();
    await service.getMetrics(NOW);
    expect(eventCount).toHaveBeenCalledWith({
      where: {
        name: 'therapy_nudge',
        createdAt: { gte: MONTH_AGO },
        AND: [
          { meta: { path: ['place'], equals: 'signal_card' } },
          { meta: { path: ['action'], equals: 'shown' } },
          { meta: { path: ['trigger'], equals: 'low_index' } },
        ],
      },
    });
    expect(eventCount).toHaveBeenCalledWith({
      where: {
        name: 'therapy_nudge',
        createdAt: { gte: MONTH_AGO },
        AND: [{ meta: { path: ['action'], equals: 'book' } }],
      },
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
