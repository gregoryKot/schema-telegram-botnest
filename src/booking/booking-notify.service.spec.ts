// BookingNotifyService — все побочные эффекты жизненного цикла брони
// (Telegram/CalDAV/e-mail-фолбэк/напоминания). Правило проекта: ошибки
// уведомлений НИКОГДА не должны падать наружу (см. .catch-конвенцию) — сама
// бронь уже создана/оплачена, потерять её из-за сбоя Telegram нельзя.
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SessionType } from '@prisma/client';
import { BookingNotifyService } from './booking-notify.service';

function makeService(
  opts: { calDavEnabled?: boolean; dueReminders?: any[] } = {},
) {
  const prisma: any = {
    booking: {
      update: jest.fn(({ where, data }: any) =>
        Promise.resolve({ id: where.id, ...data }),
      ),
      findMany: jest.fn(() => Promise.resolve(opts.dueReminders ?? [])),
    },
  };
  const telegram = { notifyAdmin: jest.fn(() => Promise.resolve(true)) };
  const calDav = {
    enabled: opts.calDavEnabled ?? true,
    pushEvent: jest.fn(() => Promise.resolve('ics-uid-1')),
    removeEvent: jest.fn(() => Promise.resolve(undefined)),
  };
  const meeting = {
    createMeeting: jest.fn(() => Promise.resolve('https://meet.jit.si/x')),
  };
  const email = {
    sendAdminNotification: jest.fn(() => Promise.resolve(undefined)),
  };
  const config = { get: () => undefined } as unknown as ConfigService;
  const service = new BookingNotifyService(
    prisma,
    telegram as any,
    calDav as any,
    meeting as any,
    email as any,
    config,
  );
  return { service, prisma, telegram, calDav, meeting, email };
}

function booking(overrides: Partial<any> = {}) {
  return {
    id: 42,
    startsAt: new Date('2026-07-13T17:00:00Z'),
    durationMin: 50,
    type: SessionType.SESSION_50,
    clientName: 'Мария',
    clientContact: '@maria',
    message: 'Первая сессия',
    meetingUrl: null,
    cancelToken: 'tok',
    ...overrides,
  };
}

describe('BookingNotifyService.onConfirmed — линк на встречу и CalDAV', () => {
  it('без готового meetingUrl создаёт встречу через MeetingService и сохраняет в БД', async () => {
    const { service, prisma, meeting } = makeService();
    const b = booking();
    await service.onConfirmed(b);
    expect(meeting.createMeeting).toHaveBeenCalledTimes(1);
    expect(b.meetingUrl).toBe('https://meet.jit.si/x'); // мутирует b, как задокументировано
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: { meetingUrl: 'https://meet.jit.si/x' },
      }),
    );
  });

  it('если meetingUrl уже был — MeetingService не вызывается повторно', async () => {
    const { service, meeting } = makeService();
    const b = booking({ meetingUrl: 'https://existing' });
    await service.onConfirmed(b);
    expect(meeting.createMeeting).not.toHaveBeenCalled();
  });

  it('пушит событие в CalDAV с корректным UID/summary/description/location', async () => {
    const { service, calDav } = makeService();
    const b = booking({ meetingUrl: 'https://meet.jit.si/x' });
    await service.onConfirmed(b);
    expect(calDav.pushEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'booking-42@schemehappens.ru',
        startsAt: b.startsAt,
        durationMin: 50,
        summary: expect.stringContaining('Мария'),
        location: 'https://meet.jit.si/x',
      }),
    );
  });

  it('успешный push сохраняет calDavUid в БД', async () => {
    const { service, prisma } = makeService();
    await service.onConfirmed(booking({ meetingUrl: 'x' }));
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { calDavUid: 'ics-uid-1' } }),
    );
  });

  it('уведомляет админа "Запись подтверждена" с именем/контактом/временем клиента', async () => {
    const { service, telegram } = makeService();
    await service.onConfirmed(booking({ meetingUrl: 'x' }));
    const text = telegram.notifyAdmin.mock.calls[0][0] as string;
    expect(text).toContain('Запись подтверждена');
    expect(text).toContain('Мария');
    expect(text).toContain('@maria');
  });

  it('CalDAV включён, но push не удался (null) — отдельное предупреждение админу вторым сообщением', async () => {
    const { service, telegram, calDav } = makeService({ calDavEnabled: true });
    calDav.pushEvent.mockResolvedValueOnce(null);
    await service.onConfirmed(booking({ meetingUrl: 'x' }));
    expect(telegram.notifyAdmin).toHaveBeenCalledTimes(2);
    expect(telegram.notifyAdmin.mock.calls[1][0]).toContain(
      'НЕ попала в Apple Calendar',
    );
  });

  it('CalDAV выключен — предупреждения о календаре не шлём, даже если pushEvent вернул null', async () => {
    const { service, telegram, calDav } = makeService({ calDavEnabled: false });
    calDav.pushEvent.mockResolvedValueOnce(null);
    await service.onConfirmed(booking({ meetingUrl: 'x' }));
    expect(telegram.notifyAdmin).toHaveBeenCalledTimes(1); // только "подтверждена"
  });
});

describe('BookingNotifyService.onCancelled', () => {
  it('с calDavUid — вызывает calDav.removeEvent с этим uid', async () => {
    const { service, calDav } = makeService();
    await service.onCancelled(booking(), 'ics-uid-old');
    expect(calDav.removeEvent).toHaveBeenCalledWith('ics-uid-old');
  });

  it('без calDavUid (null) — removeEvent не вызывается, но админ всё равно уведомлён', async () => {
    const { service, calDav, telegram } = makeService();
    await service.onCancelled(booking(), null);
    expect(calDav.removeEvent).not.toHaveBeenCalled();
    expect(telegram.notifyAdmin.mock.calls[0][0]).toContain('Запись отменена');
  });
});

describe('BookingNotifyService — прочие уведомления жизненного цикла', () => {
  it('onAwaitingPayment шлёт корректный шаблон "ожидает оплаты"', async () => {
    const { service, telegram } = makeService();
    await service.onAwaitingPayment(booking());
    expect(telegram.notifyAdmin.mock.calls[0][0]).toContain('ожидает оплаты');
  });

  it('notifyExpired шлёт по одному сообщению на каждую истёкшую бронь', async () => {
    const { service, telegram } = makeService();
    await service.notifyExpired([booking({ id: 1 }), booking({ id: 2 })]);
    expect(telegram.notifyAdmin).toHaveBeenCalledTimes(2);
    expect(telegram.notifyAdmin.mock.calls[0][0]).toContain(
      'истекла без оплаты',
    );
  });

  it('alertAdmin передаёт текст как есть, без шаблона', async () => {
    const { service, telegram } = makeService();
    await service.alertAdmin('произвольный critical alert');
    expect(telegram.notifyAdmin).toHaveBeenCalledWith(
      'произвольный critical alert',
    );
  });
});

describe('BookingNotifyService — фолбэк Telegram → e-mail, ошибки поглощаются (.catch-конвенция)', () => {
  it('Telegram недоступен — падает на e-mail с тем же текстом (без HTML-тегов)', async () => {
    const { service, telegram, email } = makeService();
    telegram.notifyAdmin.mockResolvedValueOnce(false);
    await service.alertAdmin('<b>Критично</b>');
    expect(email.sendAdminNotification).toHaveBeenCalledWith(
      'Уведомление о записи',
      'Критично',
    );
  });

  it('Telegram успешен — e-mail фолбэк не вызывается', async () => {
    const { service, email } = makeService();
    await service.alertAdmin('ok');
    expect(email.sendAdminNotification).not.toHaveBeenCalled();
  });

  it('и Telegram, и e-mail упали — метод не бросает исключение наружу (эффект уведомления не должен ронять вызывающий код)', async () => {
    const { service, telegram, email } = makeService();
    telegram.notifyAdmin.mockResolvedValueOnce(false);
    email.sendAdminNotification.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.alertAdmin('boom')).resolves.toBeUndefined();
  });
});

describe('BookingNotifyService.sendReminders (@Cron) — окна 24ч/2ч', () => {
  it('запрашивает оба окна с разными полями reminder24SentAt/reminder2SentAt', async () => {
    const { service, prisma } = makeService();
    await service.sendReminders();
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
    const fields = prisma.booking.findMany.mock.calls.map((c: any) =>
      Object.keys(c[0].where).find((k) => k.startsWith('reminder')),
    );
    expect(fields).toEqual(['reminder24SentAt', 'reminder2SentAt']);
  });

  it('только CONFIRMED-брони с ещё не отправленным напоминанием попадают в выборку (проверка where)', async () => {
    const { service, prisma } = makeService();
    await service.sendReminders();
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(BookingStatus.CONFIRMED);
    expect(where.reminder24SentAt).toBeNull();
  });

  it('для найденной due-брони шлёт напоминание и помечает поле отправленным (once per booking)', async () => {
    const due = booking({ id: 5 });
    const { service, prisma, telegram } = makeService({ dueReminders: [due] });
    await service.sendReminders();
    // due возвращается на оба окна (24ч и 2ч) фейковым findMany — 2 уведомления, 2 update.
    expect(
      telegram.notifyAdmin.mock.calls.some((c: any) =>
        c[0].includes('Напоминание'),
      ),
    ).toBe(true);
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ reminder24SentAt: expect.any(Date) }),
      }),
    );
  });
});
