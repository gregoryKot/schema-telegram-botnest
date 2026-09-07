// Перенос подписки при слиянии аккаунтов. Регрессия найдена аудитом
// 2026-09: Subscription привязана к telegramId, а merge переносит строки
// запросом `WHERE "userId" = source` — подписка оставалась на удаляемом
// аккаунте, списания продолжались, а объединённый аккаунт её не видел и не
// мог отменить. Денежный путь, поэтому проверяем итоговое ЗНАЧЕНИЕ, а не
// «update вызван».
import {
  reassignSubscriptions,
  conflictAlertText,
} from './merge-subscriptions';
import { MergeService } from './merge.service';

const SRC = 111n;
const TGT = 222n;

/**
 * Поддельная транзакция поверх массива строк: $queryRaw считает живые/всего
 * по telegramId, $executeRaw реально перевешивает — так тест видит итоговое
 * состояние таблицы, а не факт вызова.
 */
function makeTx(rows: Array<{ telegramId: bigint; status: string }>) {
  const calls: string[] = [];
  const LIVE = ['pending', 'active', 'past_due'];
  return {
    rows,
    calls,
    $queryRaw: jest.fn((sql: { values?: unknown[] }) => {
      // Последнее значение в шаблоне — telegramId, по которому считаем.
      const values = sql.values ?? [];
      const tg = values[values.length - 1] as bigint;
      const mine = rows.filter((r) => r.telegramId === tg);
      return Promise.resolve([
        {
          live: BigInt(mine.filter((r) => LIVE.includes(r.status)).length),
          total: BigInt(mine.length),
        },
      ]);
    }),
    $executeRaw: jest.fn((sql: { values?: unknown[] }) => {
      calls.push('update');
      const [newTg, oldTg] = (sql.values ?? []) as bigint[];
      for (const r of rows) if (r.telegramId === oldTg) r.telegramId = newTg;
      return Promise.resolve(rows.length);
    }),
  };
}

describe('reassignSubscriptions — подписка переезжает за пользователем', () => {
  it('подписка источника перевешивается на целевой аккаунт', async () => {
    const tx = makeTx([{ telegramId: SRC, status: 'active' }]);
    const out = await reassignSubscriptions(tx as never, SRC, TGT);

    expect(out).toEqual({ kind: 'moved', count: 1 });
    // Read-after-write: строка реально лежит под новым номером — именно так
    // её потом ищут показ и отмена подписки.
    expect(tx.rows).toEqual([{ telegramId: TGT, status: 'active' }]);
  });

  it('отменённая подписка тоже переезжает — история остаётся у человека', async () => {
    const tx = makeTx([{ telegramId: SRC, status: 'cancelled' }]);
    const out = await reassignSubscriptions(tx as never, SRC, TGT);

    expect(out).toEqual({ kind: 'moved', count: 1 });
    expect(tx.rows[0].telegramId).toBe(TGT);
  });

  it('живые подписки с обеих сторон — НЕ переносим, зовём человека', async () => {
    const tx = makeTx([
      { telegramId: SRC, status: 'active' },
      { telegramId: TGT, status: 'active' },
    ]);
    const out = await reassignSubscriptions(tx as never, SRC, TGT);

    expect(out).toEqual({ kind: 'conflict', sourceLive: 1, targetLive: 1 });
    // Ничего не тронуто: два активных списания на одном аккаунте — хуже,
    // чем неперенесённая подписка.
    expect(tx.calls).toEqual([]);
    expect(tx.rows[0].telegramId).toBe(SRC);
  });

  it('у цели только отменённая — перенос идёт (двойного списания не будет)', async () => {
    const tx = makeTx([
      { telegramId: SRC, status: 'active' },
      { telegramId: TGT, status: 'cancelled' },
    ]);
    const out = await reassignSubscriptions(tx as never, SRC, TGT);

    expect(out).toEqual({ kind: 'moved', count: 1 });
    expect(tx.rows.every((r) => r.telegramId === TGT)).toBe(true);
  });

  it('подписок у источника нет — merge проходит без лишних запросов', async () => {
    const tx = makeTx([]);
    const out = await reassignSubscriptions(tx as never, SRC, TGT);

    expect(out).toEqual({ kind: 'none' });
    expect(tx.calls).toEqual([]);
    // Цель не опрашивается вовсе — считать нечего.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('conflictAlertText — админ получает разбираемый текст', () => {
  it('называет оба номера и обе цифры', () => {
    const text = conflictAlertText(SRC, TGT, {
      kind: 'conflict',
      sourceLive: 1,
      targetLive: 2,
    });

    expect(text).toContain('111');
    expect(text).toContain('222');
    expect(text).toContain('двойное списание');
  });
});

// Ветка алерта в самом MergeService: конфликт обязан уйти в
// SecurityLogService (там бюджет DM), а не прямым notifyAdminWithFallback —
// правило №14, это же проверяет гейт check-alert-throttle.
describe('MergeService — конфликт подписок сообщается через бюджетированный канал', () => {
  it('зовёт securityLog.log с событием merge_subscription_conflict и обоими номерами', async () => {
    const rows = [
      { telegramId: SRC, status: 'active' },
      { telegramId: TGT, status: 'active' },
    ];
    const tx = makeTx(rows);
    const prisma = {
      $transaction: async (cb: (t: unknown) => Promise<void>) => {
        await cb({
          ...tx,
          user: { findUnique: jest.fn().mockResolvedValue(null) },
          $executeRaw: jest.fn().mockResolvedValue(0),
        });
      },
    };
    const securityLog = { log: jest.fn() };
    const svc = new MergeService(prisma as never, securityLog as never);

    await svc.merge(SRC, TGT);

    expect(securityLog.log).toHaveBeenCalledWith(
      'merge_subscription_conflict',
      expect.objectContaining({
        sourceId: '111',
        targetId: '222',
        sourceLive: 1,
        targetLive: 1,
      }),
    );
  });

  it('без конфликта сигнализация молчит', async () => {
    const tx = makeTx([{ telegramId: SRC, status: 'active' }]);
    const prisma = {
      $transaction: async (cb: (t: unknown) => Promise<void>) => {
        await cb({
          ...tx,
          user: { findUnique: jest.fn().mockResolvedValue(null) },
        });
      },
    };
    const securityLog = { log: jest.fn() };

    await new MergeService(prisma as never, securityLog as never).merge(
      SRC,
      TGT,
    );

    expect(securityLog.log).not.toHaveBeenCalled();
    // И подписка при этом реально переехала — молчание не от того, что
    // перенос вообще не выполнялся.
    expect(rowsOf(tx)).toEqual([{ telegramId: TGT, status: 'active' }]);
  });
});

function rowsOf(tx: ReturnType<typeof makeTx>) {
  return tx.rows;
}
