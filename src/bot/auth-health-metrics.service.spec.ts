// Агрегат здоровья входа: разбор строк запроса (bigint→number, суммы по
// площадке и причине) и то, что запрос считает только серверные строки
// (userId IS NULL). Prisma мокается (образец — account-link-metrics.service.spec.ts);
// сам SQL исполняется на живой базе в test/raw-sql-live-stats.e2e-spec.ts.
import { AuthHealthMetricsService } from './auth-health-metrics.service';
import { parseAuthHealthRows, type AuthHealthRow } from './auth-health-rows';

const row = (
  name: string,
  host: string | null,
  reason: string | null,
  day: number,
  week: number,
): AuthHealthRow => ({
  name,
  host,
  reason,
  day: BigInt(day),
  week: BigInt(week),
});

const ZERO = { day: 0, week: 0 };
const emptyHost = { ok: ZERO, expired: ZERO, suspicious: ZERO };

describe('parseAuthHealthRows', () => {
  it('пустой результат — нули по обеим площадкам, а не NaN/undefined', () => {
    expect(parseAuthHealthRows([])).toEqual({
      hosts: { telegram: emptyHost, max: emptyHost },
      legacyEmptyWeek: 0,
    });
  });

  it('раскладывает обмены по площадке, причине и окну', () => {
    const m = parseAuthHealthRows([
      row('messenger_launch', 'telegram', null, 20, 120),
      row('messenger_launch', 'max', null, 1, 9),
      row('messenger_launch_failed', 'telegram', 'expired', 4, 12),
      row('messenger_launch_failed', 'telegram', 'suspicious', 0, 3),
      row('messenger_launch_failed', 'max', 'suspicious', 2, 2),
    ]);
    expect(m.hosts.telegram).toEqual({
      ok: { day: 20, week: 120 },
      expired: { day: 4, week: 12 },
      suspicious: { day: 0, week: 3 },
    });
    expect(m.hosts.max).toEqual({
      ok: { day: 1, week: 9 },
      expired: ZERO,
      suspicious: { day: 2, week: 2 },
    });
    expect(m.legacyEmptyWeek).toBe(0);
  });

  it('пустая подпись старых окон суммируется по площадкам за неделю', () => {
    const m = parseAuthHealthRows([
      row('auth_rejected', 'telegram', 'empty_signature', 1, 4),
      row('auth_rejected', 'max', 'empty_signature', 0, 2),
    ]);
    expect(m.legacyEmptyWeek).toBe(6);
    expect(m.hosts.telegram).toEqual(emptyHost);
  });

  // Подделка через POST /api/event: sanitizeMeta отрезал meta, host и reason
  // приходят NULL — такая строка не должна попасть ни в одну клетку.
  it('строки с NULL или незнакомой площадкой/причиной не считаются', () => {
    const m = parseAuthHealthRows([
      row('messenger_launch', null, null, 5, 5),
      row('messenger_launch', 'web', null, 5, 5),
      row('messenger_launch_failed', 'telegram', null, 5, 5),
      row('messenger_launch_failed', 'max', 'empty_signature', 5, 5),
      row('messenger_launch_failed', null, 'expired', 5, 5),
      row('auth_rejected', null, null, 5, 5),
      row('auth_success', 'telegram', null, 5, 5),
    ]);
    expect(m).toEqual({
      hosts: { telegram: emptyHost, max: emptyHost },
      legacyEmptyWeek: 0,
    });
  });
});

describe('AuthHealthMetricsService.getMetrics', () => {
  const build = (rows: AuthHealthRow[]) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new AuthHealthMetricsService(prisma), queryRaw };
  };

  it('отдаёт разобранные строки запроса', async () => {
    const { service } = build([
      row('messenger_launch', 'telegram', null, 3, 30),
      row('messenger_launch_failed', 'telegram', 'expired', 1, 2),
    ]);
    const m = await service.getMetrics();
    expect(m.hosts.telegram.ok).toEqual({ day: 3, week: 30 });
    expect(m.hosts.telegram.expired).toEqual({ day: 1, week: 2 });
  });

  // Ключевой инвариант: /api/event открыт авторизованным клиентам, и без
  // фильтра по userId любой из них мог бы накрутить отчёт о здоровье входа.
  it('считает только серверные строки трёх событий с userId IS NULL', async () => {
    const { service, queryRaw } = build([]);
    await service.getMetrics();
    const sql = (queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain('"userId" IS NULL');
    expect(sql).toContain(
      `"name" IN ('messenger_launch', 'messenger_launch_failed', 'auth_rejected')`,
    );
    expect(sql).not.toContain('auth_success');
  });
});

describe('AuthHealthMetricsService.getLaunches', () => {
  it('раскладывает запуски по площадке и платформе, пустые ключи отбрасывает', async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([
      { host: 'telegram', platform: 'ios', week: 5n, prev: 7n },
      { host: null, platform: 'ios', week: 1n, prev: 0n },
    ]);
    const service = new AuthHealthMetricsService({
      $queryRaw: queryRaw,
    } as never);
    await expect(service.getLaunches()).resolves.toEqual([
      { host: 'telegram', platform: 'ios', week: 5, prevWeek: 7 },
    ]);
    // Подделка через /api/event несёт userId — в отчёт она не попадает.
    const sql = (queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain(`"name" = 'messenger_launch'`);
    expect(sql).toContain('"userId" IS NULL');
  });

  it('render — блок входа и строка платформ, пустая БД без NaN', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const service = new AuthHealthMetricsService({
      $queryRaw: queryRaw,
    } as never);
    const text = await service.render();
    expect(text).toContain('Вход в мессенджере');
    expect(text).toContain('сравнивать пока не с чем');
    expect(text).toContain('по платформам пока нет');
    expect(text).not.toMatch(/NaN|undefined/);
  });
});
