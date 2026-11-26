// Инцидент 2026-11-07 (docs/INCIDENTS.md): трекер алерта жил в памяти процесса,
// и каждый деплой присылал владельцу тот же DM самопроверки заново — три за 15
// минут. Решение теперь в базе (аренда CronLease); здесь — решение по ответам
// базы. Атомарность захвата — свойство Postgres, её держит
// test/cron-leader.e2e-spec.ts.
import {
  ALERT_LEASE_PREFIX,
  AlertLeaseStore,
  alertLeaseName,
  alertLeaseStore,
  decideSelfCheckAlert,
} from './alert-dedup';
import { REMIND_EVERY_MS, SelfCheckAlertTracker } from './alert-tracker';
import type { SelfCheckResultEntry } from './state';
import type { PrismaService } from '../../prisma/prisma.service';

const H = 3_600_000;

function failed(id: string, detail = 'сломано'): SelfCheckResultEntry {
  return { id, title: `Проба ${id}`, ok: false, detail, reportInHealth: true };
}

/** Таблица CronLease той же семантики, что claimRun: строка моложе окна —
 * захват не удался. Общая для «процессов» теста — как база для инстансов. */
function leaseDb() {
  const rows = new Map<string, number>();
  let now = Date.parse('2026-11-07T00:17:00Z');
  const store: AlertLeaseStore = {
    claim: (name, windowMs) => {
      const at = rows.get(name);
      if (at !== undefined && now - at < windowMs)
        return Promise.resolve(false);
      rows.set(name, now);
      return Promise.resolve(true);
    },
    clearAll: () => {
      const names = [...rows.keys()].filter((n) =>
        n.startsWith(ALERT_LEASE_PREFIX),
      );
      names.forEach((n) => rows.delete(n));
      return Promise.resolve(names.length);
    },
  };
  return { rows, store, advance: (ms: number) => (now += ms) };
}

const brokenDb: AlertLeaseStore = {
  claim: () => Promise.reject(new Error("Can't reach database server")),
  clearAll: () => Promise.reject(new Error("Can't reach database server")),
};

describe('decideSelfCheckAlert — решение в базе', () => {
  it('первый красный прогон — DM со списком, строка аренды записана', async () => {
    const db = leaseDb();
    const text = await decideSelfCheckAlert(
      [failed('telegram', 'fetch failed')],
      db.store,
      new SelfCheckAlertTracker(),
    );
    expect(text).toContain('Самопроверка нашла проблему');
    expect(text).toContain('Проба telegram: fetch failed');
    expect([...db.rows.keys()]).toEqual(['self-check-alert:telegram']);
  });

  it('рестарт (деплой): новый процесс, строка моложе 6 ч — без DM', async () => {
    const db = leaseDb();
    await decideSelfCheckAlert(
      [failed('ciRuns')],
      db.store,
      new SelfCheckAlertTracker(),
    );
    db.advance(7 * 60_000); // следующий деплой, память процесса пуста
    const again = await decideSelfCheckAlert(
      [failed('ciRuns')],
      db.store,
      new SelfCheckAlertTracker(),
    );
    expect(again).toBeNull();
  });

  it('два инстанса во время деплоя — DM уходит один раз', async () => {
    const db = leaseDb();
    const [a, b] = await Promise.all([
      decideSelfCheckAlert(
        [failed('ciRuns')],
        db.store,
        new SelfCheckAlertTracker(),
      ),
      decideSelfCheckAlert(
        [failed('ciRuns')],
        db.store,
        new SelfCheckAlertTracker(),
      ),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('порядок проб не важен — тот же набор, та же строка', () => {
    expect(alertLeaseName([failed('telegram'), failed('googleOAuth')])).toBe(
      alertLeaseName([failed('googleOAuth'), failed('telegram')]),
    );
    expect(alertLeaseName([failed('telegram'), failed('googleOAuth')])).toBe(
      'self-check-alert:googleOAuth,telegram',
    );
  });

  it('сменился набор упавших — DM о новом наборе', async () => {
    const db = leaseDb();
    const memory = new SelfCheckAlertTracker();
    await decideSelfCheckAlert([failed('ciRuns')], db.store, memory);
    db.advance(H);
    const text = await decideSelfCheckAlert(
      [failed('ciRuns'), failed('caldav', 'iCloud 403')],
      db.store,
      memory,
    );
    expect(text).toContain('Самопроверка нашла проблемы (2)');
    expect(text).toContain('iCloud 403');
  });

  it('красное дольше 6 ч — напоминание, раньше — тишина', async () => {
    const db = leaseDb();
    const memory = new SelfCheckAlertTracker();
    await decideSelfCheckAlert([failed('db')], db.store, memory);
    db.advance(REMIND_EVERY_MS - 1);
    expect(
      await decideSelfCheckAlert([failed('db')], db.store, memory),
    ).toBeNull();
    db.advance(1);
    expect(
      await decideSelfCheckAlert([failed('db')], db.store, memory),
    ).toContain('Самопроверка нашла проблему');
  });

  it('зелёный при строках алерта — «снова зелёная», строки удалены, следующий сбой алертит сразу', async () => {
    const db = leaseDb();
    db.rows.set('threadsTokenRefresh', 0); // аренда крона — не наша, не трогаем
    await decideSelfCheckAlert(
      [failed('telegram')],
      db.store,
      new SelfCheckAlertTracker(),
    );
    db.advance(H);
    const green = await decideSelfCheckAlert(
      [],
      db.store,
      new SelfCheckAlertTracker(),
    );
    expect(green).toBe('✅ Самопроверка снова зелёная — всё в порядке.');
    expect([...db.rows.keys()]).toEqual(['threadsTokenRefresh']);
    db.advance(H);
    expect(
      await decideSelfCheckAlert(
        [failed('telegram')],
        db.store,
        new SelfCheckAlertTracker(),
      ),
    ).toContain('Самопроверка нашла проблему');
  });

  it('зелёный без строк алерта — тишина', async () => {
    const db = leaseDb();
    expect(
      await decideSelfCheckAlert([], db.store, new SelfCheckAlertTracker()),
    ).toBeNull();
  });
});

describe('decideSelfCheckAlert — база недоступна: память процесса', () => {
  it('красное — DM по смене состояния, повтор того же — без дубля', async () => {
    const memory = new SelfCheckAlertTracker();
    const first = await decideSelfCheckAlert([failed('db')], brokenDb, memory);
    expect(first).toContain('Самопроверка нашла проблему');
    expect(
      await decideSelfCheckAlert([failed('db')], brokenDb, memory),
    ).toBeNull();
    expect(memory.isOpen).toBe(true);
  });

  it('зелёное без базы после алерта из памяти — «снова зелёная»', async () => {
    const memory = new SelfCheckAlertTracker();
    await decideSelfCheckAlert([failed('db')], brokenDb, memory);
    expect(await decideSelfCheckAlert([], brokenDb, memory)).toContain(
      'снова зелёная',
    );
  });

  it('база вернулась, строк нет, но из памяти алертили — «снова зелёная» один раз', async () => {
    const db = leaseDb();
    const memory = new SelfCheckAlertTracker();
    await decideSelfCheckAlert([failed('db')], brokenDb, memory);
    expect(await decideSelfCheckAlert([], db.store, memory)).toContain(
      'снова зелёная',
    );
    expect(memory.isOpen).toBe(false);
    expect(await decideSelfCheckAlert([], db.store, memory)).toBeNull();
  });

  it('отказ базы посреди красного, о котором сообщили через базу, — DM уходит', async () => {
    const db = leaseDb();
    const memory = new SelfCheckAlertTracker();
    await decideSelfCheckAlert([failed('telegram')], db.store, memory);
    const text = await decideSelfCheckAlert(
      [failed('telegram'), failed('db', 'не отвечает')],
      brokenDb,
      memory,
    );
    expect(text).toContain('Проба db: не отвечает');
  });
});

describe('alertLeaseStore', () => {
  it('захват — claimRunOrThrow с окном напоминания; чистка — только строки алертов', async () => {
    const claimRunOrThrow = jest.fn().mockResolvedValue(true);
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const store = alertLeaseStore({ claimRunOrThrow }, {
      cronLease: { deleteMany },
    } as unknown as PrismaService);
    await expect(
      store.claim('self-check-alert:db', REMIND_EVERY_MS),
    ).resolves.toBe(true);
    expect(claimRunOrThrow).toHaveBeenCalledWith(
      'self-check-alert:db',
      REMIND_EVERY_MS,
    );
    await expect(store.clearAll()).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { name: { startsWith: 'self-check-alert:' } },
    });
  });

  it('ошибка базы всплывает, а не превращается в «уже сообщили»', async () => {
    const store = alertLeaseStore(
      {
        claimRunOrThrow: jest.fn().mockRejectedValue(new Error('P1001')),
      },
      {
        cronLease: {
          deleteMany: jest.fn().mockRejectedValue(new Error('P1001')),
        },
      } as unknown as PrismaService,
    );
    await expect(
      store.claim('self-check-alert:db', REMIND_EVERY_MS),
    ).rejects.toThrow('P1001');
    await expect(store.clearAll()).rejects.toThrow('P1001');
  });
});
