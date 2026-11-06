// «⏰ Напомню через час» (telegram.snooze.ts) без бота: расчёт момента и текст
// итога. Порядок «тост → запись → итог» и ветку сбоя хендлера проверяет
// telegram.service.spec.ts, переживание рестарта — telegram.restart-reminders.seam.spec.ts.
import {
  SnoozeFailed,
  snoozeFailText,
  snoozeReminder,
  snoozeSendAt,
} from './telegram.snooze';

function makeDeps(settings: Record<string, unknown> | null, now: number) {
  return {
    accountService: {
      canonicalUserId: jest.fn(async (id: number) => BigInt(id)),
    },
    botService: { getUserSettings: jest.fn().mockResolvedValue(settings) },
    notificationService: {
      cancel: jest.fn().mockResolvedValue(undefined),
      schedule: jest.fn().mockResolvedValue(undefined),
    },
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
    expect(snoozeSendAt(now, 'Europe/Moscow', 22, 8).toISOString()).toBe(
      '2026-10-11T12:30:00.000Z',
    );
  });

  it('час попал в тишину — к её концу, 08:00 по поясу человека', () => {
    const now = Date.parse('2026-10-11T18:30:00Z'); // 21:30 МСК → 22:30 в тишине
    expect(snoozeSendAt(now, 'Europe/Moscow', 22, 8).toISOString()).toBe(
      '2026-10-12T05:00:00.000Z',
    );
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
    expect(deps.notificationService.schedule).toHaveBeenCalledWith(
      7n,
      'pre_reminder',
      new Date('2026-10-11T12:30:00Z'),
    );
    expect(ctx.editMessageText).toHaveBeenCalledWith('⏰ Напомню в 18:00');
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
