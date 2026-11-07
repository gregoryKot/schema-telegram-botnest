// Аренда полуночного обхода на фейковом времени: тик в 00:00 и захват при
// старте процесса через настоящий CronLeaderService. Фейк Prisma повторяет
// условие SQL захвата («прошлый прогон не позже now − окно»), иначе тест
// проверял бы мок, а не механизм.
//
// Регресс (docs/open/backend.md, 2026-10): тик и старт брали аренду на 23 ч.
// Старт в 23:30 UTC забирал обход, и тик в 00:00 получал отказ — у людей в UTC
// и западнее следующие сутки оставались без обхода. Так же поздний старт после
// пропущенной полуночи (захват в 05:00 → отказ тику через 19 ч).
import { Logger } from '@nestjs/common';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import {
  CATCH_UP_CUTOFF_MS,
  catchUpClaimWindowMs,
} from './telegram.midnight-lease';

interface Lease {
  name: string;
  runAt: Date;
  doneRunAt: Date | null;
}

/** Строка CronLease и три запроса к ней: захват, отметка, чтение. */
function fakePrisma(lease: { row?: Lease }) {
  return {
    // Порядок значений — как в claimRun: name, now, id, now, id, notAfter.
    $executeRaw: (_sql: TemplateStringsArray, ...v: unknown[]) => {
      const [name, now, , , , notAfter] = v as [string, Date, ...Date[]];
      if (lease.row && lease.row.runAt > notAfter) return Promise.resolve(0);
      lease.row = { name, runAt: now, doneRunAt: lease.row?.doneRunAt ?? null };
      return Promise.resolve(1);
    },
    cronLease: {
      findUnique: () => Promise.resolve(lease.row ?? null),
      updateMany: ({ where, data }: { where: Lease; data: Partial<Lease> }) => {
        if (lease.row?.runAt.getTime() === where.runAt.getTime())
          Object.assign(lease.row, data);
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaService;
}

/** «Процесс»: сервис с настоящим арендодателем поверх общей строки аренды. */
function makeProcess(lease: { row?: Lease }, walks: Date[]) {
  const stub = {} as never;
  const accounts = { getAllUsersWithSettings: () => Promise.resolve([{}]) };
  const planner = {
    planDay: (_u: unknown, now: Date) => void walks.push(now),
  };
  return new TelegramScheduleService(
    { telegram: {} } as never,
    stub,
    stub,
    accounts as never,
    stub,
    stub,
    stub,
    planner as never,
    new CronLeaderService(fakePrisma(lease)),
  );
}

const at = (iso: string) => new Date(iso);

describe('аренда полуночного обхода: тик и старт процесса', () => {
  let lease: { row?: Lease };
  let walks: Date[];

  /** Тик @Cron('0 0 * * *') в момент `iso`. */
  async function tick(iso: string) {
    jest.setSystemTime(at(iso));
    await makeProcess(lease, walks).scheduleDailyReminders();
  }
  /** Старт процесса: доделка/захват, как через 30 с после onModuleInit. */
  async function start(iso: string) {
    jest.setSystemTime(at(iso));
    await makeProcess(lease, walks).catchUpAfterStart();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    lease = {};
    walks = [];
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('старт в 23:30 UTC после обычной полуночи → обход в 00:00 следующих суток выполняется', async () => {
    await tick('2026-10-22T00:00:00.010Z');
    await start('2026-10-22T23:30:00Z');
    await tick('2026-10-23T00:00:00.010Z');
    expect(walks).toEqual([
      at('2026-10-22T00:00:00.010Z'),
      at('2026-10-23T00:00:00.010Z'),
    ]);
  });

  it('полночь пропущена, старт в 05:00 → старт обходит, и тик следующей полуночи тоже', async () => {
    await tick('2026-10-21T00:00:00Z');
    await start('2026-10-22T05:00:00Z');
    await tick('2026-10-23T00:00:00Z');
    expect(walks).toEqual([
      at('2026-10-21T00:00:00Z'),
      at('2026-10-22T05:00:00Z'),
      at('2026-10-23T00:00:00Z'),
    ]);
  });

  it('полночь пропущена, старт в 22:59 → тик в 00:00 всё равно проходит', async () => {
    await tick('2026-10-21T00:00:00Z');
    await start('2026-10-22T22:59:00Z');
    await tick('2026-10-23T00:00:00Z');
    expect(walks).toHaveLength(3);
  });

  it('обычный catch-up: обход этих суток уже был → старт днём не обходит повторно', async () => {
    await tick('2026-10-22T00:00:00Z');
    await start('2026-10-22T10:00:00Z');
    expect(walks).toEqual([at('2026-10-22T00:00:00Z')]);
  });

  it('обычный catch-up: самый первый старт без аренды — обходит', async () => {
    await start('2026-10-22T10:00:00Z');
    expect(walks).toEqual([at('2026-10-22T10:00:00Z')]);
  });

  it('второй инстанс той же полуночи получает отказ — окно часа дубли отсекает', async () => {
    await tick('2026-10-22T00:00:00.010Z');
    await tick('2026-10-22T00:00:00.500Z');
    expect(walks).toHaveLength(1);
  });

  it('тик выстрелил на миг раньше 00:00 → второй инстанс и дневной старт не повторяют обход', async () => {
    await tick('2026-10-21T23:59:59.900Z');
    await tick('2026-10-22T00:00:00.200Z');
    await start('2026-10-22T10:00:00Z');
    expect(walks).toEqual([at('2026-10-21T23:59:59.900Z')]);
  });

  it('инвариант окон: захват старта кончается раньше, чем начинается окно тика', () => {
    expect(CATCH_UP_CUTOFF_MS).toBeGreaterThan(LEASE_WINDOW.hourly);
    expect(catchUpClaimWindowMs(at('2026-10-22T22:59:59Z'))).not.toBeNull();
    expect(catchUpClaimWindowMs(at('2026-10-22T23:00:00Z'))).toBeNull();
    expect(catchUpClaimWindowMs(at('2026-10-22T23:59:59Z'))).toBeNull();
    expect(catchUpClaimWindowMs(at('2026-10-22T00:00:00Z'))).toBe(5 * 60_000);
  });
});
