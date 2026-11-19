import { GuideReferenceMetricsService } from './guide-reference-metrics.service';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const SINCE = new Date(NOW.getTime() - 30 * 86_400_000);

function makeService(opts: {
  counts?: Record<string, number>;
  groups?: Array<{ userId: bigint | null }>;
}) {
  // Два groupBy: по userId — терапевты, по name — счётчики листов одним запросом.
  const groupBy = jest.fn(
    ({ by, where }: { by: string[]; where: { name: { in?: string[] } } }) =>
      Promise.resolve(
        by[0] === 'userId'
          ? (opts.groups ?? [])
          : (where.name.in ?? [])
              .filter((name) => opts.counts?.[name])
              .map((name) => ({ name, _count: { _all: opts.counts?.[name] } })),
      ),
  );
  // count — счётчики карточки-ответа (guide-answer-metrics) в render().
  const count = jest.fn(() => Promise.resolve(0));
  const prisma = { analyticsEvent: { count, groupBy } };
  return {
    service: new GuideReferenceMetricsService(prisma as never),
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
        cabinet_guide_need_open: 5,
        cabinet_guide_table_open: 6,
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
      needs30: 5,
      tables30: 6,
    });
  });

  it('окно createdAt >= 30 дней назад; терапевты — по открытию, без анонимов', async () => {
    const { service, groupBy } = makeService({});
    await service.getMetrics();
    expect(groupBy).toHaveBeenCalledTimes(2);
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['name'],
        where: expect.objectContaining({ createdAt: { gte: SINCE } }),
      }),
    );
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
