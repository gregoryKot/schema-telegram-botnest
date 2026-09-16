import { cronLeasesProbe } from './probe-cron-leases';
import {
  CRON_LEASE_WINDOW_KEY,
  NOMINAL_PERIOD_MS,
} from './cron-lease-registry';
import type { PrismaService } from '../../prisma/prisma.service';

const NAMES = Object.keys(CRON_LEASE_WINDOW_KEY);
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
});
