import { TaskAssignMetricsService } from './task-assign-metrics.service';

type Where = { name: string; meta: { path: string[]; equals: unknown } };

describe('TaskAssignMetricsService', () => {
  it('считает назначения по источнику из meta', async () => {
    const rows = [
      { name: 'task_assign_source', source: 'catalog' },
      { name: 'task_assign_source', source: 'catalog' },
      { name: 'task_assign_source', source: 'tile' },
      { name: 'therapy_plan_item_added', source: 'custom' },
    ];
    const count = jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(
        rows.filter(
          (r) => r.name === where.name && r.source === where.meta.equals,
        ).length,
      ),
    );
    const service = new TaskAssignMetricsService({
      analyticsEvent: { count },
    } as never);
    await expect(service.getMetrics()).resolves.toEqual({
      tile30: 1,
      catalog30: 2,
      custom30: 0,
    });
  });
});
