// Правило пробы аренд: сбой — два пропущенных тика в зоне ответственности
// процесса, а не возраст аренды. Регрессия 2026-10-17 (docs/INCIDENTS.md):
// после аварии базы оконные кроны канала держали `cronLeases` красным до
// следующего окна, хотя процесс ни одного своего тика не пропустил.
import {
  EXCUSE_BACKSTOP_MS,
  leaseAgeLimitMs,
  leaseProblem,
} from './cron-lease-verdict';
import { CRON_LEASE_REGISTRY } from './cron-lease-registry';

const at = (s: string) => new Date(s).getTime();
const MIN = 60_000;
const EVENING = CRON_LEASE_REGISTRY.healthyAdultEvening;
const MORNING = CRON_LEASE_REGISTRY.healthyAdultMorning;
const FIVE = CRON_LEASE_REGISTRY.bookingReminders;
const DAILY = CRON_LEASE_REGISTRY.midnightPlanner;

describe('leaseProblem — регрессия 2026-10-17: окна канала пришлись на аварию базы', () => {
  it('после рестарта: вечер не отработал 17-го, процесс жив 6 мин — не сбой', () => {
    expect(
      leaseProblem(EVENING, {
        runAt: at('2026-10-16T16:55:00Z'),
        now: at('2026-10-18T04:43:00Z'),
        startedAt: at('2026-10-18T04:37:00Z'),
      }),
    ).toBeNull();
  });

  it('без рестарта: тики окна упали на недоступной базе — не сбой', () => {
    expect(
      leaseProblem(EVENING, {
        runAt: at('2026-10-16T16:55:00Z'),
        now: at('2026-10-18T04:43:00Z'),
        startedAt: at('2026-10-17T03:00:00Z'),
        lastDbFailureAt: at('2026-10-17T16:55:00Z'),
      }),
    ).toBeNull();
  });

  it('утреннее окно (06:00–07:55Z 17-го) — так же', () => {
    expect(
      leaseProblem(MORNING, {
        runAt: at('2026-10-16T07:55:00Z'),
        now: at('2026-10-18T04:43:00Z'),
        startedAt: at('2026-10-17T03:00:00Z'),
        lastDbFailureAt: at('2026-10-17T07:55:00Z'),
      }),
    ).toBeNull();
  });
});

describe('leaseProblem — контроль: мёртвый крон по-прежнему красный', () => {
  it('процесс жив, базу не теряли, вечерние 16:50 и 16:55 не захвачены — сбой', () => {
    expect(
      leaseProblem(EVENING, {
        runAt: at('2026-10-16T16:55:00Z'),
        now: at('2026-10-17T17:10:00Z'),
        startedAt: at('2026-10-17T14:00:00Z'),
      }),
    ).toBe(
      'два тика подряд не отработали (16:50 и 16:55 UTC), последний раз 24 ч назад',
    );
  });

  it('отказ базы был раньше обоих пропущенных тиков — не оправдание', () => {
    expect(
      leaseProblem(EVENING, {
        runAt: at('2026-10-16T16:55:00Z'),
        now: at('2026-10-17T17:10:00Z'),
        startedAt: at('2026-10-17T14:00:00Z'),
        lastDbFailureAt: at('2026-10-17T16:45:00Z'),
      }),
    ).toContain('два тика подряд не отработали');
  });

  it('*/5: процесс жив час, последний захват 13 мин назад — сбой', () => {
    expect(
      leaseProblem(FIVE, {
        runAt: at('2026-10-18T11:47:30Z'),
        now: at('2026-10-18T12:00:30Z'),
        startedAt: at('2026-10-18T11:00:00Z'),
      }),
    ).toBe(
      'два тика подряд не отработали (11:50 и 11:55 UTC), последний раз 13 мин назад',
    );
  });

  it('аренды нет, процесс жив час — «ни разу не отработал»', () => {
    expect(
      leaseProblem(FIVE, {
        now: at('2026-10-18T12:00:30Z'),
        startedAt: at('2026-10-18T11:00:00Z'),
      }),
    ).toBe('ни разу не отработал');
  });

  it('рестарты прикрывают суточный крон не дольше предела: 5 суток без захвата — сбой', () => {
    const now = at('2026-10-18T12:00:00Z');
    expect(
      leaseProblem(DAILY, {
        runAt: now - 5 * 24 * 3_600_000,
        now,
        startedAt: now - 3_600_000,
      }),
    ).toBe('последний раз 120 ч назад');
  });
});

describe('leaseProblem — допуски', () => {
  it('один пропущенный тик */5 — не сбой', () => {
    expect(
      leaseProblem(FIVE, {
        runAt: at('2026-10-18T11:50:00.200Z'),
        now: at('2026-10-18T12:00:30Z'),
        startedAt: at('2026-10-18T11:00:00Z'),
      }),
    ).toBeNull();
  });

  it('старт 60 с назад, захват 13 мин назад (деплой) — не сбой', () => {
    const now = at('2026-10-18T12:00:30Z');
    expect(
      leaseProblem(FIVE, { runAt: now - 13 * MIN, now, startedAt: now - MIN }),
    ).toBeNull();
  });

  it('захват на 2 с раньше номинала тика — тот же тик', () => {
    expect(
      leaseProblem(FIVE, {
        runAt: at('2026-10-18T11:49:58Z'),
        now: at('2026-10-18T12:00:30Z'),
        startedAt: at('2026-10-18T11:00:00Z'),
      }),
    ).toBeNull();
  });

  it('тик, которому ещё нет 90 с, не судится (claimRun может висеть до таймаута пула)', () => {
    // 11:55 и 11:50 пропущены, но 11:55 моложе 90 с — судим по 11:50 и 11:45.
    expect(
      leaseProblem(FIVE, {
        runAt: at('2026-10-18T11:45:00Z'),
        now: at('2026-10-18T11:56:00Z'),
        startedAt: at('2026-10-18T11:00:00Z'),
      }),
    ).toBeNull();
  });

  it('аренды нет, процесс жив меньше двух тиков — ждать рано', () => {
    const now = at('2026-10-18T12:00:30Z');
    expect(leaseProblem(DAILY, { now, startedAt: now - 3_600_000 })).toBeNull();
  });

  it('суточный крон после рестарта в пределах предела — не сбой', () => {
    const now = at('2026-10-18T12:00:00Z');
    expect(
      leaseProblem(DAILY, {
        runAt: now - leaseAgeLimitMs(DAILY.cron) - EXCUSE_BACKSTOP_MS + MIN,
        now,
        startedAt: now - 3_600_000,
      }),
    ).toBeNull();
  });
});

describe('leaseProblem — несуточное расписание: прежнее правило возраста', () => {
  const MONTHLY = { cron: '0 3 1 * *' }; // порог — 7 суток + 1 сутки
  const now = at('2026-10-18T12:00:00Z');
  const DAY = 24 * 3_600_000;

  it('захват 3 суток назад — не сбой', () => {
    expect(
      leaseProblem(MONTHLY, {
        runAt: now - 3 * DAY,
        now,
        startedAt: now - DAY,
      }),
    ).toBeNull();
  });

  it('захват 9 суток назад — сбой с возрастом', () => {
    expect(
      leaseProblem(MONTHLY, {
        runAt: now - 9 * DAY,
        now,
        startedAt: now - DAY,
      }),
    ).toBe('последний раз 216 ч назад');
  });

  it('аренды нет: сбой только когда процесс жив дольше порога', () => {
    expect(leaseProblem(MONTHLY, { now, startedAt: now - DAY })).toBeNull();
    expect(leaseProblem(MONTHLY, { now, startedAt: now - 9 * DAY })).toBe(
      'ни разу не отработал',
    );
  });
});

describe('leaseAgeLimitMs', () => {
  it('равномерный крон — ровно два периода', () => {
    expect(leaseAgeLimitMs('* * * * *')).toBe(2 * MIN);
    expect(leaseAgeLimitMs('0 0 * * *')).toBe(2 * 24 * 3_600_000);
  });

  it('оконный крон — разрыв окна (22ч05м) + шаг (5м)', () => {
    expect(leaseAgeLimitMs(MORNING.cron)).toBe(
      22 * 3_600_000 + 5 * MIN + 5 * MIN,
    );
  });
});
