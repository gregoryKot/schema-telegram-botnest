import { SearchMetricsService } from './search-metrics.service';

type Where = { name: string; meta: { path: [string]; equals: unknown } };

describe('SearchMetricsService', () => {
  it('считает открытия по виду результата и отдельно — после набора запроса', async () => {
    const rows = [
      { name: 'search_result_open', kind: 'guide', typed: true },
      { name: 'search_result_open', kind: 'guide', typed: false },
      { name: 'search_result_open', kind: 'client', typed: true },
      { name: 'task_assign_source', kind: 'guide', typed: true },
    ];
    const count = jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(
        rows.filter(
          (r) =>
            r.name === where.name &&
            r[where.meta.path[0] as 'kind' | 'typed'] === where.meta.equals,
        ).length,
      ),
    );
    const service = new SearchMetricsService({
      analyticsEvent: { count },
    } as never);
    await expect(service.getMetrics()).resolves.toEqual({
      clients30: 1,
      sections30: 0,
      guide30: 2,
      actions30: 0,
      typed30: 2,
    });
  });
});
