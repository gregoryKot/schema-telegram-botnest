// Агрегат переносов аккаунта: маппинг bigint→number и то, что запрос считает
// именно наши три события. Prisma мокается.
import { AccountLinkMetricsService } from './account-link-metrics.service';

describe('AccountLinkMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new AccountLinkMetricsService(prisma), queryRaw };
  };

  const ROW = {
    started: 10n,
    started_users: 7n,
    confirmed: 6n,
    merged: 5n,
    failed: 2n,
  };

  it('раскладывает счётчики по колонкам', async () => {
    const { service } = build([ROW]);
    await expect(service.getMetrics()).resolves.toEqual({
      started30: 10,
      startedUsers30: 7,
      confirmed30: 6,
      merged30: 5,
      failed30: 2,
    });
  });

  it('пустой результат запроса — нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      started30: 0,
      startedUsers30: 0,
      confirmed30: 0,
      merged30: 0,
      failed30: 0,
    });
  });

  it('ходит в БД один раз — три счётчика не стоят трёх запросов', async () => {
    const { service, queryRaw } = build([ROW]);
    // build() отдаёт результат ТОЛЬКО первому вызову: если запросов станет
    // больше, следующий вернёт undefined и метрики развалятся.
    const metrics = await service.getMetrics();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(metrics.started30).toBe(10);
    expect(metrics.failed30).toBe(2);
  });

  it('в запросе перечислены ровно наши события', async () => {
    const { service, queryRaw } = build([ROW]);
    await service.getMetrics();

    const sql = (
      queryRaw.mock.calls[0][0] as { join?: unknown } & string[]
    ).join('');
    expect(sql).toContain('account_link_started');
    expect(sql).toContain('account_link_confirmed');
    expect(sql).toContain('account_link_failed');
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([ROW]);
    await expect(service.render()).resolves.toContain(
      'Начинали переносить: 10 раз (7 человек)',
    );
  });
});
