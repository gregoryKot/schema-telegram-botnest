// Регресс инцидента 2026-09-13: создание брони падало на КАЖДОЙ попытке
// («Failed to deserialize column of type 'void'»), человек получал 500, а его
// имя и контакт терялись — админу уходил лишь троттлённый DM «Ошибка на
// сервере» без контакта. Резерв: любое неожиданное падение → лид админу в оба
// канала, затем исключение пробрасывается (ложного успеха быть не должно).
// Паттерн и тест-мутант — как у донатов (donation.service.create.spec.ts).
import { ConflictException, Logger } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { createBookingGuarded } from './booking.create';
import { PII, expectNoMarkers } from '../test-support/pii-markers';
import type { OwnerNotice } from '../utils/owner-card';

const LEAD = {
  clientName: 'Мария',
  clientContact: '@maria',
  startsAt: new Date('2026-09-20T13:00:00Z'),
  durationMin: 15,
  type: SessionType.INTRO_15,
  message: 'хочу разобраться с тревогой',
};

function makeDeps(opts: { lockError?: Error; taken?: boolean } = {}) {
  const tx = {
    $executeRaw: jest.fn(async () => {
      if (opts.lockError) throw opts.lockError;
      return 1;
    }),
    booking: {
      findMany: jest.fn(async () =>
        opts.taken ? [{ startsAt: LEAD.startsAt, durationMin: 50 }] : [],
      ),
      create: jest.fn(async ({ data }: any) => ({ id: 7, ...data })),
    },
  };
  const prisma: any = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
  const notify = {
    notifyAdminBoth: jest.fn(async (_t: OwnerNotice, _s: string) => undefined),
  };
  const logger = new Logger('test');
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  return { deps: { prisma, notify, logger }, tx, notify, logger };
}

describe('createBookingGuarded — резерв для заявки (инцидент 2026-09-13)', () => {
  it('ровно сегодняшняя поломка: лок падает ошибкой драйвера → лид с именем и контактом уходит админу, исключение пробрасывается', async () => {
    const { deps, notify, tx } = makeDeps({
      lockError: new Error(
        "Raw query failed. Code: `N/A`. Message: `Failed to deserialize column of type 'void'`",
      ),
    });

    await expect(
      createBookingGuarded(deps, { clientName: 'x' } as any, LEAD),
    ).rejects.toThrow(/void/);

    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    const [html, subject] = notify.notifyAdminBoth.mock.calls[0];
    // Письмо — всё, чтобы связаться вручную, вместе с текстом ошибки.
    expect(html.email).toContain('НЕ сохранилась');
    expect(html.email).toContain('Мария');
    expect(html.email).toContain('@maria');
    expect(html.email).toContain('хочу разобраться с тревогой');
    expect(html.email).toContain("column of type 'void'");
    // Telegram — факт, слот и тип ошибки; без данных человека и её текста.
    expect(html.telegram).toContain('НЕ сохранилась');
    expect(html.telegram).toContain('Причина: Error');
    expect(html.telegram).not.toContain('Мария');
    expect(html.telegram).not.toContain('@maria');
    expect(html.telegram).not.toContain('тревогой');
    expect(html.telegram).not.toContain('void');
    expect(subject).toContain('не сохранилась');
  });

  it('провал: в error (уходит владельцу в Telegram) — стабильный тип ошибки, её текст — в warn', async () => {
    const { deps, logger } = makeDeps({ lockError: new Error('pool closed') });
    await expect(
      createBookingGuarded(deps, { clientName: 'x' } as any, LEAD),
    ).rejects.toThrow('pool closed');
    expect(logger.error).toHaveBeenCalledWith(
      'Booking create failed, lead alerted: Error',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Booking create failure: pool closed',
    );
  });

  it('данные человека и текст ошибки не уходят ни в Telegram-карточку, ни в error', async () => {
    const err = Object.assign(new Error(PII.error), { code: 'P1001' });
    const { deps, notify, logger } = makeDeps({ lockError: err });
    const lead = {
      ...LEAD,
      clientName: PII.name,
      clientContact: PII.contact,
      message: PII.message,
    };
    await expect(createBookingGuarded(deps, {} as any, lead)).rejects.toBe(err);
    const [html] = notify.notifyAdminBoth.mock.calls[0];
    expectNoMarkers(html.telegram);
    expect(html.telegram).toContain('Error P1001');
    expectNoMarkers(String((logger.error as jest.Mock).mock.calls[0][0]));
    for (const m of [PII.name, PII.contact, PII.message, PII.error]) {
      expect(html.email).toContain(m);
    }
  });

  it('БД недоступна ещё до лока (сам $transaction бросает) — тоже лид админу', async () => {
    const { deps, notify } = makeDeps();
    deps.prisma.$transaction.mockRejectedValueOnce(
      new Error('connection terminated'),
    );

    await expect(createBookingGuarded(deps, {} as any, LEAD)).rejects.toThrow(
      'connection terminated',
    );
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    expect(notify.notifyAdminBoth.mock.calls[0][0].email).toContain(
      'connection terminated',
    );
  });

  it('слот занят (ConflictException) — ожидаемый исход: лида НЕТ, исключение как было', async () => {
    const { deps, notify } = makeDeps({ taken: true });
    await expect(
      createBookingGuarded(deps, {} as any, LEAD),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  it('успех — бронь создана внутри транзакции после лока, алерта нет', async () => {
    const { deps, notify, tx } = makeDeps();
    const row = await createBookingGuarded(
      deps,
      { clientName: 'x' } as any,
      LEAD,
    );
    expect(row.id).toBe(7);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.booking.create).toHaveBeenCalledTimes(1);
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  it('падение самого алерта не глотает исходную ошибку и не подменяет её', async () => {
    const { deps, notify } = makeDeps({ lockError: new Error('driver boom') });
    notify.notifyAdminBoth.mockRejectedValueOnce(new Error('tg down'));
    await expect(createBookingGuarded(deps, {} as any, LEAD)).rejects.toThrow(
      /driver boom|tg down/,
    );
  });
});

// Доля «время уже заняли» в /stats (аудит 2026-10, r2-1#2): 409 законен при
// гонке двух клиентов, поэтому важен не факт, а доля. Счётчик — серверное
// событие booking_slot_taken без userId; пишется только на 409.
describe('createBookingGuarded — счётчик «время уже заняли»', () => {
  const withAnalytics = (opts: Parameters<typeof makeDeps>[0] = {}) => {
    const made = makeDeps(opts);
    const track = jest.fn(async () => undefined);
    return { ...made, deps: { ...made.deps, analytics: { track } }, track };
  };

  it('слот занят → событие booking_slot_taken без userId, 409 уходит клиенту как был', async () => {
    const { deps, track } = withAnalytics({ taken: true });

    await expect(createBookingGuarded(deps, {} as any, LEAD)).rejects.toThrow(
      ConflictException,
    );

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(null, 'booking_slot_taken');
  });

  it('контроль: бронь создана — события нет', async () => {
    const { deps, track } = withAnalytics();

    await expect(
      createBookingGuarded(deps, { clientName: 'x' } as any, LEAD),
    ).resolves.toEqual({ id: 7, clientName: 'x' });

    expect(track).not.toHaveBeenCalled();
  });

  it('контроль: падение БД — не «время заняли»: события нет, лид уходит админу', async () => {
    const { deps, track, notify } = withAnalytics({
      lockError: new Error('connection terminated'),
    });

    await expect(createBookingGuarded(deps, {} as any, LEAD)).rejects.toThrow(
      'connection terminated',
    );

    expect(track).not.toHaveBeenCalled();
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
  });
});

// Второй рубеж против записи поверх личного события (аудит 2026-10): при
// включённой блокировке календарём (deps.calendar задан) слот сверяется с
// занятостью CalDAV до лока. Fail-open: календарь упал — запись проходит.
describe('createBookingGuarded — занятость календаря', () => {
  const busyAt = (start: Date) => ({
    getBusyTimes: jest.fn(async () => [
      { start, end: new Date(start.getTime() + 3_600_000) },
    ]),
  });

  it('слот поверх события календаря → 409 «Slot already taken», INSERT не делается, счётчик «заняли»', async () => {
    const made = makeDeps();
    const track = jest.fn(async () => undefined);
    const calendar = busyAt(LEAD.startsAt);
    const deps = { ...made.deps, analytics: { track }, calendar };

    const err = await createBookingGuarded(deps, {} as any, LEAD).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe('Slot already taken');
    expect(made.tx.booking.create).not.toHaveBeenCalled();
    expect(made.notify.notifyAdminBoth).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(null, 'booking_slot_taken');
  });

  it('календарь упал → запись проходит (fail-open)', async () => {
    const made = makeDeps();
    jest.spyOn(made.logger, 'warn').mockImplementation(() => undefined);
    const calendar = {
      getBusyTimes: jest.fn(async () => {
        throw new Error('REPORT 503');
      }),
    };
    await expect(
      createBookingGuarded(
        { ...made.deps, calendar },
        { clientName: 'x' } as never,
        LEAD,
      ),
    ).resolves.toEqual({ id: 7, clientName: 'x' });
  });

  it('контроль: календарь свободен — бронь создаётся, окно запроса — сам слот', async () => {
    const made = makeDeps();
    const calendar = busyAt(new Date(LEAD.startsAt.getTime() + 3_600_000));
    await expect(
      createBookingGuarded({ ...made.deps, calendar }, {} as never, LEAD),
    ).resolves.toEqual({ id: 7 });
    expect(calendar.getBusyTimes).toHaveBeenCalledWith(
      LEAD.startsAt,
      new Date(LEAD.startsAt.getTime() + 15 * 60_000),
    );
  });
});
