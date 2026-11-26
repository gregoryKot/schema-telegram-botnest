// Шов пробы: настоящая проба + настоящий реестр + настоящее правило
// (cron-lease-verdict.ts) + настоящая память отказов claimRun
// (cron-claim-failures.ts); подделана только `prisma.cronLease.findMany`.
import { cronLeasesProbe } from './probe-cron-leases';
import { expectedLeases } from './cron-lease-expected';
import { noteClaimFailure } from '../cron-claim-failures';
import { latestTicks } from './cron-ticks';
import { hhmm } from './cron-lease-verdict';
import type { PrismaService } from '../../prisma/prisma.service';

// Аренды кронов за выключенными фичами (подписка) проба не судит.
const NAMES = expectedLeases();
const at = (s: string) => new Date(s).getTime();
const noFailures = () => undefined;

type Life = { startedAt: Date; seenAt: Date; dbFailureAt: Date | null };

/** Подделаны только запросы: аренды и жизни прошлых процессов (process-lives.ts). */
function fakePrisma(
  rows: Array<{ name: string; runAt: Date; doneRunAt?: Date | null }>,
  lives: Life[] = [],
): PrismaService {
  return {
    cronLease: { findMany: jest.fn().mockResolvedValue(rows) },
    processLife: {
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue(lives),
    },
  } as unknown as PrismaService;
}

/** Все аренды захвачены 30 с назад, кроме переопределённых (null — строки нет). */
function rowsAt(now: number, override: Record<string, number | null> = {}) {
  return NAMES.filter((name) => override[name] !== null).map((name) => ({
    name,
    runAt: new Date(override[name] ?? now - 30_000),
  }));
}

describe('cronLeasesProbe', () => {
  const realNow = Date.now;
  afterEach(() => {
    Date.now = realNow;
  });

  it('все кроны отработали свои тики — ok', async () => {
    const now = at('2026-10-18T12:00:30Z');
    Date.now = () => now;
    const res = await cronLeasesProbe(
      fakePrisma(rowsAt(now)),
      now - 3_600_000,
      noFailures,
    ).run();
    expect(res).toEqual({
      ok: true,
      detail: `все ${NAMES.length} кронов тикают по расписанию`,
    });
  });

  it('*/5-крон пропустил два тика — не ok, называет его и сами тики', async () => {
    const now = at('2026-10-18T12:00:30Z');
    Date.now = () => now;
    const rows = rowsAt(now, { bookingReminders: at('2026-10-18T11:47:30Z') });
    const res = await cronLeasesProbe(
      fakePrisma(rows),
      now - 24 * 3_600_000,
      noFailures,
    ).run();
    expect(res).toEqual({
      ok: false,
      detail:
        'bookingReminders: два тика подряд не отработали (11:50 и 11:55 UTC), последний раз 13 мин назад',
    });
  });

  it('записи нет, процесс жив дольше двух тиков — «ни разу не отработал»', async () => {
    const now = at('2026-10-18T12:00:30Z');
    Date.now = () => now;
    const rows = rowsAt(now, { bookingExpireHolds: null });
    const res = await cronLeasesProbe(
      fakePrisma(rows),
      now - 10 * 60_000,
      noFailures,
    ).run();
    expect(res).toEqual({
      ok: false,
      detail: 'bookingExpireHolds: ни разу не отработал',
    });
  });

  it('записи нет, но процесс только что стартовал — ждать рано', async () => {
    const now = at('2026-10-18T12:00:30Z');
    Date.now = () => now;
    const rows = rowsAt(now, { midnightPlanner: null });
    const res = await cronLeasesProbe(
      fakePrisma(rows),
      now - 3_600_000,
      noFailures,
    ).run();
    expect(res.ok).toBe(true);
  });

  // Аудит 2026-10: суточный крон при деплоях чаще раза в сутки ловился на
  // 4-е сутки. Жизни прошлых процессов приходят из базы (process-lives.ts).
  it('полуночный планировщик мёртв, деплой каждые 8 ч — красный на вторые сутки', async () => {
    // Тики — в зоне процесса (сьюты гоняются и под Сиднеем), не 00:00 UTC.
    const H = 3_600_000;
    const [t1] = latestTicks('0 0 * * *', new Date('2026-11-03T03:00:00Z'))!;
    const last = t1.getTime();
    const runAt = last - 48 * H;
    const now = last + 3 * H;
    Date.now = () => now;
    const lives: Life[] = [];
    for (let start = runAt + 2 * H; start + 8 * H <= now; start += 8 * H) {
      const seenAt = new Date(start + 7 * H + 60_000);
      lives.push({ startedAt: new Date(start), seenAt, dbFailureAt: null });
    }
    const rows = rowsAt(now, { midnightPlanner: runAt });
    const res = await cronLeasesProbe(
      fakePrisma(rows, lives),
      now - H,
      noFailures,
    ).run();
    expect(res).toEqual({
      ok: false,
      detail: `midnightPlanner: два тика подряд не отработали (${hhmm(last - 24 * H)} и ${hhmm(last)} UTC), последний раз 51 ч назад`,
    });
  });

  it('проба отмечает свой процесс: старт, прогон и последний отказ базы', async () => {
    const now = at('2026-11-03T03:00:00Z');
    Date.now = () => now;
    const prisma = fakePrisma(rowsAt(now));
    const fails: Record<string, number> = {
      notificationQueue: at('2026-11-03T02:40:00Z'),
      bookingReminders: at('2026-11-03T02:50:00Z'),
    };
    await cronLeasesProbe(
      prisma,
      at('2026-11-03T02:00:00Z'),
      (name) => fails[name],
    ).run();
    expect(prisma.processLife.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          startedAt: new Date('2026-11-03T02:00:00Z'),
          seenAt: new Date(now),
          dbFailureAt: new Date('2026-11-03T02:50:00Z'),
        }),
      }),
    );
  });

  // Регрессия 2026-09-16 (#503): оконный крон законно молчит между окнами.
  it('аренда с последнего тика утреннего окна (10:55 МСК) в порядке вечером', async () => {
    const now = at('2026-09-16T17:43:00Z'); // 20:43 МСК
    Date.now = () => now;
    const rows = rowsAt(now, {
      healthyAdultMorning: at('2026-09-16T07:55:00Z'),
    });
    const res = await cronLeasesProbe(
      fakePrisma(rows),
      now - 24 * 3_600_000,
      noFailures,
    ).run();
    expect(res.ok).toBe(true);
  });

  // Регрессия 2026-10-17 (docs/INCIDENTS.md): оба окна канала 17-го пришлись
  // на аварию базы. По возрасту аренды проба краснела до следующих окон.
  describe('после аварии базы 2026-10-17', () => {
    const now = at('2026-10-18T04:43:00Z');
    const rows = () =>
      rowsAt(now, {
        healthyAdultMorning: at('2026-10-16T07:55:00Z'),
        healthyAdultEvening: at('2026-10-16T16:55:00Z'),
      });

    it('процесс перезапущен после аварии (прод, 04:37Z) — ok', async () => {
      Date.now = () => now;
      const res = await cronLeasesProbe(
        fakePrisma(rows()),
        at('2026-10-18T04:37:00Z'),
        noFailures,
      ).run();
      expect(res).toEqual({
        ok: true,
        detail: `все ${NAMES.length} кронов тикают по расписанию`,
      });
    });

    it('контроль: тот же процесс без памяти об аварии — красный по обоим окнам', async () => {
      Date.now = () => now;
      const res = await cronLeasesProbe(
        fakePrisma(rows()),
        at('2026-10-16T03:00:00Z'),
        noFailures,
      ).run();
      expect(res.ok).toBe(false);
      expect(res.detail).toContain('healthyAdultMorning: два тика подряд');
      expect(res.detail).toContain('healthyAdultEvening: два тика подряд');
    });

    it('процесс пережил аварию: отказы claimRun по недоступной базе оправдывают окна — ok', async () => {
      Date.now = () => now;
      const dbDown = new Error("Can't reach database server at db:5432");
      noteClaimFailure(
        'healthyAdultMorning',
        dbDown,
        new Date('2026-10-17T07:55:00Z'),
      );
      noteClaimFailure(
        'healthyAdultEvening',
        dbDown,
        new Date('2026-10-17T16:55:00Z'),
      );
      const res = await cronLeasesProbe(
        fakePrisma(rows()),
        at('2026-10-16T03:00:00Z'),
      ).run();
      expect(res.ok).toBe(true);
    });

    it('контроль: отказ claimRun НЕ из-за базы (таблицы нет) — крон мёртв, красный', async () => {
      Date.now = () => now;
      // Своё имя аренды: память отказов общая на файл.
      noteClaimFailure(
        'healthyAdultCatchUp',
        new Error('relation "CronLease" does not exist'),
        new Date('2026-10-18T04:30:00Z'),
      );
      const res = await cronLeasesProbe(
        fakePrisma(
          rowsAt(now, { healthyAdultCatchUp: at('2026-10-18T04:00:00Z') }),
        ),
        at('2026-10-17T23:00:00Z'),
      ).run();
      expect(res).toEqual({
        ok: false,
        detail:
          'healthyAdultCatchUp: два тика подряд не отработали (04:15 и 04:30 UTC), последний раз 43 мин назад',
      });
    });
  });

  // Аудит 2026-10: полуночный обход, оборванный деплоем, для правила тиков
  // «свеж» — аренда захвачена. Второе правило смотрит, дошёл ли прогон до конца.
  describe('незавершённый прогон (cron-lease-done.ts)', () => {
    const now = at('2026-10-18T12:00:30Z');
    const midnight = new Date('2026-10-18T00:00:00Z');
    const withMidnight = (doneRunAt: Date | null) =>
      rowsAt(now).map((r) =>
        r.name === 'midnightPlanner'
          ? { ...r, runAt: midnight, doneRunAt }
          : { ...r, doneRunAt: null },
      );

    it('обход начат в 00:00 и не закончен к полудню — не ok, простыми словами', async () => {
      Date.now = () => now;
      const res = await cronLeasesProbe(
        fakePrisma(withMidnight(null)),
        now - 24 * 3_600_000,
        noFailures,
      ).run();
      expect(res).toEqual({
        ok: false,
        detail:
          'midnightPlanner: обход, начатый в 00:00 UTC, не дошёл до конца — часть людей осталась без запланированных сообщений',
      });
    });

    it('обход отмечен завершённым тем же runAt — ok', async () => {
      Date.now = () => now;
      const res = await cronLeasesProbe(
        fakePrisma(withMidnight(new Date(midnight))),
        now - 24 * 3_600_000,
        noFailures,
      ).run();
      expect(res.ok).toBe(true);
    });

    const prevMidnight = new Date('2026-10-17T00:00:00Z');

    it('процесс поднялся меньше двух часов назад — даёт время доделать', async () => {
      Date.now = () => now;
      const res = await cronLeasesProbe(
        fakePrisma(withMidnight(prevMidnight)),
        now - 60_000,
        noFailures,
      ).run();
      expect(res.ok).toBe(true);
    });

    // Первый деплой колонки днём: у строки из базы doneRunAt = NULL, прошлый
    // обход прошёл старым кодом, доделать его некому (окно доделки 6 ч).
    it('первый деплой днём: отметки не было ни разу — ok, ложной тревоги нет', async () => {
      Date.now = () => now;
      const res = await cronLeasesProbe(
        fakePrisma(withMidnight(null)),
        now - 3 * 3_600_000,
        noFailures,
      ).run();
      expect(res.ok).toBe(true);
    });

    it('контроль: отметка от прошлого прогона при том же старте — не ok', async () => {
      Date.now = () => now;
      const res = await cronLeasesProbe(
        fakePrisma(withMidnight(prevMidnight)),
        now - 3 * 3_600_000,
        noFailures,
      ).run();
      expect(res.ok).toBe(false);
    });
  });
});
