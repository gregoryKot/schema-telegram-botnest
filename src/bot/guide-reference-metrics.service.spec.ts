import { GuideReferenceMetricsService } from './guide-reference-metrics.service';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const SINCE = new Date(NOW.getTime() - 30 * 86_400_000);

function makeService(opts: {
  counts?: Record<string, number>;
  groups?: Array<{ userId: bigint | null }>;
}) {
  const count = jest.fn(({ where }: { where: { name: string } }) =>
    Promise.resolve(opts.counts?.[where.name] ?? 0),
  );
  const groupBy = jest.fn(() => Promise.resolve(opts.groups ?? []));
  const prisma = { analyticsEvent: { count, groupBy } };
  return {
    service: new GuideReferenceMetricsService(prisma as never),
    count,
    groupBy,
  };
}

describe('GuideReferenceMetricsService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('каждое поле — своё событие cabinet_guide_*, терапевты — distinct', async () => {
    const { service } = makeService({
      counts: {
        cabinet_guide_open: 7,
        cabinet_guide_mode_open: 3,
        cabinet_guide_schema_open: 2,
        cabinet_guide_technique_open: 4,
        cabinet_guide_note_open: 1,
        // те же листы из схемы случая сюда не попадают
        concept_guide_mode_open: 99,
      },
      groups: [{ userId: 1n }, { userId: 2n }],
    });
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 7,
      therapists30: 2,
      modes30: 3,
      schemas30: 2,
      techniques30: 4,
      notes30: 1,
    });
  });

  it('окно createdAt >= 30 дней назад; терапевты — по открытию, без анонимов', async () => {
    const { service, count, groupBy } = makeService({});
    await service.getMetrics();
    expect(count).toHaveBeenCalledWith({
      where: { name: 'cabinet_guide_open', createdAt: { gte: SINCE } },
    });
    expect(count).toHaveBeenCalledTimes(5);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['userId'],
      where: {
        name: 'cabinet_guide_open',
        createdAt: { gte: SINCE },
        userId: { not: null },
      },
    });
  });

  it('пустая БД — человеческая строка в render()', async () => {
    const { service } = makeService({});
    await expect(service.render()).resolves.toContain(
      'Пока никто из терапевтов не открывал справочник',
    );
  });
});
