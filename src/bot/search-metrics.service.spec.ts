import { SearchMetricsService } from './search-metrics.service';

type Row = { name: string; kind: string; typed: boolean; recent?: boolean };
type Where = { name: string; meta: { path: [string]; equals: unknown } };

describe('SearchMetricsService', () => {
  it('считает открытия по виду результата и отдельно — после набора запроса и из недавнего', async () => {
    const rows: Row[] = [
      { name: 'search_result_open', kind: 'guide', typed: true },
      { name: 'search_result_open', kind: 'guide', typed: false, recent: true },
      { name: 'search_result_open', kind: 'client', typed: true },
      { name: 'search_result_open', kind: 'client_tab', typed: true },
      { name: 'search_result_open', kind: 'task', typed: false },
      { name: 'task_assign_source', kind: 'guide', typed: true },
    ];
    const count = jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(
        rows.filter(
          (r) =>
            r.name === where.name &&
            r[where.meta.path[0] as keyof Row] === where.meta.equals,
        ).length,
      ),
    );
    const service = new SearchMetricsService({
      analyticsEvent: { count },
    } as never);
    await expect(service.getMetrics()).resolves.toEqual({
      clients30: 1,
      tabs30: 1,
      sections30: 0,
      guide30: 2,
      tasks30: 1,
      actions30: 0,
      typed30: 3,
      recent30: 1,
    });
  });
});
