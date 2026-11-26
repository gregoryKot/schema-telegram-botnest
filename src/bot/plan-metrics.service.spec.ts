import { PlanMetricsService } from './plan-metrics.service';

type Where = { name: string; meta?: { path: string[]; equals: unknown } };

// Счёт по имени события и, если задан, по значению поля meta.
function makeService(rows: Array<{ name: string; meta: object }>) {
  const count = jest.fn(({ where }: { where: Where }) =>
    Promise.resolve(
      rows.filter(
        (r) =>
          r.name === where.name &&
          (!where.meta ||
            (r.meta as Record<string, unknown>)[where.meta.path[0]] ===
              where.meta.equals),
      ).length,
    ),
  );
  const groupBy = jest.fn(() => Promise.resolve([{ userId: 1n }]));
  const prisma = {
    analyticsEvent: { count, groupBy },
    therapyPlanItem: { count: jest.fn().mockResolvedValue(3) },
  };
  return new PlanMetricsService(prisma as never);
}

describe('PlanMetricsService.legacySourceCount', () => {
  it('считает пункты со старым источником без нового адреса', async () => {
    await expect(makeService([]).legacySourceCount()).resolves.toBe(3);
  });
});

describe('PlanMetricsService', () => {
  it('разрез по meta: из справочника и по статусам', async () => {
    const service = makeService([
      { name: 'therapy_plan_item_added', meta: { fromGuide: true } },
      { name: 'therapy_plan_item_added', meta: { fromGuide: false } },
      { name: 'therapy_plan_item_status', meta: { status: 'active' } },
      { name: 'therapy_plan_item_status', meta: { status: 'done' } },
      { name: 'therapy_plan_item_status', meta: { status: 'done' } },
      { name: 'therapy_plan_item_status', meta: { status: 'planned' } },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      added30: 2,
      fromGuide30: 1,
      therapists30: 1,
      active30: 1,
      done30: 2,
    });
  });
});
