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
      { name: 'search_result_open', kind: 'own_task', typed: true },
      { name: 'search_result_open', kind: 'pattern', typed: false },
      { name: 'search_result_open', kind: 'setting', typed: true },
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
      byKind30: {
        client: 1,
        client_tab: 1,
        section: 0,
        guide: 2,
        task: 1,
        action: 0,
        pattern: 1,
        exercise: 0,
        plan: 0,
        own_task: 1,
        article: 0,
        setting: 1,
      },
      typed30: 5,
      recent30: 1,
    });
  });
});
