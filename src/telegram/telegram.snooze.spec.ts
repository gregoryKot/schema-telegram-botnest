// «⏰ Напомню через час» (telegram.snooze.ts) без бота: расчёт момента и текст
// итога. Порядок «тост → запись → итог» и ветку сбоя хендлера проверяет
// telegram.service.spec.ts, переживание рестарта — telegram.restart-reminders.seam.spec.ts.
import {
  SnoozeFailed,
  snoozeFailText,
  snoozeReminder,
  snoozeSendAt,
} from './telegram.snooze';

/**
 * Очередь уведомлений в памяти: каждый вызов — отдельный «запрос к БД».
 * replacePending — как в базе: «снять этого типа + поставить» под локом на
 * человека (src/notification/replace-pending.ts), вызовы идут по одному.
 */
function memoryQueue() {
  const rows: { type: string; sendAt: Date; cancelled: boolean }[] = [];
  const db = () => new Promise((r) => setImmediate(r));
  const pending = (type: string) =>
    rows.filter((r) => r.type === type && !r.cancelled);
  let lockTail: Promise<unknown> = Promise.resolve();
  const replace = async (type: string, sendAt: Date) => {
    await db();
    for (const r of pending(type)) r.cancelled = true;
    await db();
    rows.push({ type, sendAt, cancelled: false });
  };
  return {
    rows,
    pending,
    cancel: jest.fn(async (_u: bigint, type: string) => {
      await db();
      for (const r of pending(type)) r.cancelled = true;
    }),
    replacePending: jest.fn((_u: bigint, type: string, sendAt: Date) => {
      const run = lockTail.then(() => replace(type, sendAt));
      lockTail = run.catch(() => undefined);
      return run;
    }),
  };
}

function makeDeps(settings: Record<string, unknown> | null, now: number) {
  return {
    accountService: {
      canonicalUserId: jest.fn(async (id: number) => BigInt(id)),
    },
    botService: { getUserSettings: jest.fn().mockResolvedValue(settings) },
    notificationService: memoryQueue(),
    analytics: { track: jest.fn().mockResolvedValue(undefined) },
    now: () => now,
  };
}

function makeCtx() {
  return {
    editMessageText: jest.fn().mockResolvedValue(true),
    reply: jest.fn().mockResolvedValue(true),
  };
}

describe('snoozeSendAt', () => {
  it('вне тихих часов — ровно через час', () => {
    const now = Date.parse('2026-10-11T11:30:00Z'); // 14:30 МСК
    const { at, quietShift } = snoozeSendAt(now, 'Europe/Moscow', 22, 8);
    expect(at.toISOString()).toBe('2026-10-11T12:30:00.000Z');
    expect(quietShift).toBe(false);
  });

  it('час попал в тишину — к её концу, 08:00 по поясу человека', () => {
    const now = Date.parse('2026-10-11T18:30:00Z'); // 21:30 МСК → 22:30 в тишине
    const { at, quietShift } = snoozeSendAt(now, 'Europe/Moscow', 22, 8);
    expect(at.toISOString()).toBe('2026-10-12T05:00:00.000Z');
    expect(quietShift).toBe(true);
  });
});

describe('snoozeReminder', () => {
  it('время в итоге — по часам пояса, включая получасовые (Индия)', async () => {
    // 12:30 UTC = 18:00 в Калькутте. Старый расчёт брал смещение целыми
    // часами (Math.round(5.5) = 6) и писал «18:30».
    const deps = makeDeps(
      { notifyTimezone: 'Asia/Kolkata' },
      Date.parse('2026-10-11T11:30:00Z'),
    );
    const ctx = makeCtx();
    await snoozeReminder(deps, ctx as never, 7);
    expect(deps.notificationService.replacePending).toHaveBeenCalledWith(
      7n,
      'pre_reminder',
      new Date('2026-10-11T12:30:00Z'),
    );
    expect(ctx.editMessageText).toHaveBeenCalledWith('⏰ Напомню в 18:00');
  });

  // Аудит 2026-10: снималось только напоминание, а уже отложенное — нет, и
  // второе нажатие до правки сообщения (кнопки исчезают только с итогом)
  // ставило второе «через час». Отложенное ставится через replacePending.
  it('второе нажатие снимает уже отложенное — в очереди одно, напоминание снято', async () => {
    const deps = makeDeps(null, Date.parse('2026-10-11T11:30:00Z'));
    const q = deps.notificationService;
    q.rows.push({ type: 'reminder', sendAt: new Date(0), cancelled: false });
    await snoozeReminder(deps, makeCtx() as never, 7);
    await snoozeReminder(deps, makeCtx() as never, 7);
    expect(q.pending('pre_reminder')).toHaveLength(1);
    expect(q.pending('reminder')).toHaveLength(0);
  });

  it('параллельный двойной тап — в очереди одно отложенное', async () => {
    const deps = makeDeps(null, Date.parse('2026-10-11T11:30:00Z'));
    await Promise.all([
      snoozeReminder(deps, makeCtx() as never, 7),
      snoozeReminder(deps, makeCtx() as never, 7),
    ]);
    expect(deps.notificationService.pending('pre_reminder')).toHaveLength(1);
  });

  // Правило №8: кнопку видно в /stats (notify-queue-metrics.*) — событие пишет
  // бот после записи, с quietShift: по нему отчёт отличает строки бота от клиента.
  it('событие reminder_snoozed — после постановки в очередь, с quietShift', async () => {
    const deps = makeDeps(null, Date.parse('2026-10-11T18:30:00Z'));
    await snoozeReminder(deps, makeCtx() as never, 7);
    expect(deps.analytics.track).toHaveBeenCalledWith(7n, 'reminder_snoozed', {
      quietShift: true,
    });
    const [scheduled] =
      deps.notificationService.replacePending.mock.invocationCallOrder;
    const [tracked] = deps.analytics.track.mock.invocationCallOrder;
    expect(scheduled).toBeLessThan(tracked);
  });

  it('двойной тап («не изменено») — успех, второго сообщения нет', async () => {
    const deps = makeDeps(null, Date.parse('2026-10-11T11:30:00Z'));
    const ctx = makeCtx();
    ctx.editMessageText.mockRejectedValue({
      description: 'Bad Request: message is not modified',
    });
    await snoozeReminder(deps, ctx as never, 7);
    expect(ctx.editMessageText).toHaveBeenCalledWith('⏰ Напомню в 15:30');
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('сбой записи — SnoozeFailed с формой человека и исходной причиной, итога нет', async () => {
    const deps = makeDeps(
      { addressForm: 'vy' },
      Date.parse('2026-10-11T11:30:00Z'),
    );
    deps.notificationService.cancel.mockRejectedValue(new Error('db down'));
    const ctx = makeCtx();
    const err = await snoozeReminder(deps, ctx as never, 7).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(SnoozeFailed);
    expect(err).toMatchObject({ form: 'vy', message: 'db down' });
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    // Не отложили — не считаем: иначе /stats показал бы нажатия без напоминаний.
    expect(deps.analytics.track).not.toHaveBeenCalled();
  });
});

describe('snoozeFailText', () => {
  it('форма из SnoozeFailed, иначе «ты» (настройки не прочитались)', () => {
    expect(snoozeFailText(new Error('db down'))).toContain('Попробуй нажать');
    expect(snoozeFailText(new SnoozeFailed('vy', new Error('x')))).toContain(
      'Попробуйте нажать',
    );
  });
});
