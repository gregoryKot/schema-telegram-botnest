import { cronLeasesProbe } from './probe-cron-leases';
import { CRON_LEASE_REGISTRY, NOMINAL_PERIOD_MS } from './cron-lease-registry';
import type { PrismaService } from '../../prisma/prisma.service';

const NAMES = Object.keys(CRON_LEASE_REGISTRY);
const NOW = 1_700_000_000_000;

function fakePrisma(rows: Array<{ name: string; runAt: Date }>): PrismaService {
  return {
    cronLease: { findMany: jest.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
}

describe('cronLeasesProbe', () => {
  const realNow = Date.now;
  afterEach(() => {
    Date.now = realNow;
  });

  it('все аренды свежие — ok', async () => {
    Date.now = () => NOW;
    const rows = NAMES.map((name) => ({ name, runAt: new Date(NOW - 30_000) }));
    const res = await cronLeasesProbe(fakePrisma(rows), NOW - 3_600_000).run();
    expect(res).toEqual({
      ok: true,
      detail: `все ${NAMES.length} аренды свежие`,
    });
  });

  it('одна аренда старше двух периодов — не ok, называет её и возраст', async () => {
    Date.now = () => NOW;
    const staleAge = 2 * NOMINAL_PERIOD_MS.fiveMinutes + 60_000; // fiveMinutes-категория
    const rows = NAMES.map((name) =>
      name === 'bookingReminders'
        ? { name, runAt: new Date(NOW - staleAge) }
        : { name, runAt: new Date(NOW - 30_000) },
    );
    const res = await cronLeasesProbe(
      fakePrisma(rows),
      NOW - 24 * 3_600_000,
    ).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('bookingReminders');
    expect(res.detail).not.toContain('healthyAdultMorning');
  });

  it('записи вообще нет, но процесс только что стартовал — не авария (ждать рано)', async () => {
    Date.now = () => NOW;
    // midnightPlanner — суточный крон, процесс жив всего час.
    const rows = NAMES.filter((n) => n !== 'midnightPlanner').map((name) => ({
      name,
      runAt: new Date(NOW - 30_000),
    }));
    const res = await cronLeasesProbe(fakePrisma(rows), NOW - 3_600_000).run();
    expect(res.ok).toBe(true);
  });

  it('записи нет, и процесс живёт дольше двух периодов — авария («ни разу не отработал»)', async () => {
    Date.now = () => NOW;
    const rows = NAMES.filter((n) => n !== 'bookingExpireHolds').map(
      (name) => ({
        name,
        runAt: new Date(NOW - 30_000),
      }),
    );
    // bookingExpireHolds — everyMinute-категория, 2 периода = 2 мин.
    const res = await cronLeasesProbe(
      fakePrisma(rows),
      NOW - 10 * 60_000,
    ).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('bookingExpireHolds: ни разу не отработал');
  });

  // Регрессия 2026-09-16 (issue #501, docs/INCIDENTS.md): порог свежести
  // брался из категории окна (LEASE_WINDOW.fiveMinutes → 2×5мин), а не из
  // расписания крона. healthyAdultMorning законно тикает только 09:00–10:55
  // МСК, поэтому по старой логике порог сгорал уже в 11:05 МСК — prod-smoke
  // был красным (`selfCheck.failed: ["cronLeases"]`) почти круглосуточно.
  describe('healthyAdultMorning — оконный крон, молчание между окнами не авария', () => {
    it('аренда с последнего тика утреннего окна (10:55 МСК) свежа вечером (20:43 МСК)', async () => {
      const now = new Date('2026-09-16T17:43:00Z').getTime(); // 20:43 МСК
      Date.now = () => now;
      const rows = NAMES.map((name) =>
        name === 'healthyAdultMorning'
          ? { name, runAt: new Date('2026-09-16T07:55:00Z') } // 10:55 МСК
          : { name, runAt: new Date(now - 30_000) },
      );
      const res = await cronLeasesProbe(
        fakePrisma(rows),
        now - 24 * 3_600_000,
      ).run();
      expect(res.ok).toBe(true);
    });

    it('контроль: та же аренда, не обновлявшаяся двое суток, — по-прежнему авария', async () => {
      const now = new Date('2026-09-16T17:43:00Z').getTime();
      Date.now = () => now;
      const rows = NAMES.map((name) =>
        name === 'healthyAdultMorning'
          ? { name, runAt: new Date(now - 2 * 24 * 3_600_000) }
          : { name, runAt: new Date(now - 30_000) },
      );
      const res = await cronLeasesProbe(
        fakePrisma(rows),
        now - 24 * 3_600_000,
      ).run();
      expect(res.ok).toBe(false);
      expect(res.detail).toContain('healthyAdultMorning');
    });
  });
});
