// Агрегат пути входа: маппинг bigint→number и — главное — то, что запрос
// считает ТОЛЬКО серверные строки. Событие пишет один шов (LoginTicketReport)
// всегда с userId = null, а /api/event открыт клиентам: без фильтра отчёт о
// здоровье входа накручивался бы с любого фронта. Образец —
// auth-health-metrics.service.spec.ts.
import { LoginTicketMetricsService } from './login-ticket-metrics.service';

describe('LoginTicketMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new LoginTicketMetricsService(prisma), queryRaw };
  };

  it('раскладывает ступени воронки по полям', async () => {
    const { service } = build([
      {
        issued: 120n,
        bot_opened: 60n,
        confirmed: 74n,
        taken: 71n,
        too_late: 5n,
        denied: 1n,
      },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      issued: 120,
      botOpened: 60,
      confirmed: 74,
      taken: 71,
      tooLate: 5,
      denied: 1,
    });
  });

  it('пустой результат — нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      issued: 0,
      botOpened: 0,
      confirmed: 0,
      taken: 0,
      tooLate: 0,
      denied: 0,
    });
  });

  it('считает только серверные строки события входа', async () => {
    const { service, queryRaw } = build([]);
    await service.getMetrics();
    const sql = (
      queryRaw.mock.calls[0][0] as { join?: unknown } & string[]
    ).join('?');
    expect(sql).toContain('"userId" IS NULL');
    expect(sql).toContain(`"name" = 'login_ticket_step'`);
  });

  it('окно — ровно неделя, границей идёт параметр запроса', async () => {
    const { service, queryRaw } = build([]);
    const before = Date.now();
    await service.getMetrics();
    const since = queryRaw.mock.calls[0][1] as Date;
    expect(since).toBeInstanceOf(Date);
    const days = (before - since.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(7, 3);
  });

  it('render отдаёт готовый текст блока', async () => {
    const { service } = build([]);
    await expect(service.render()).resolves.toContain('Вход по коду');
  });
});
