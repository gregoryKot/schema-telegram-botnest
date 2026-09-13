// Регресс инцидента 2026-09-13: создание брони падало на КАЖДОЙ попытке
// («Failed to deserialize column of type 'void'»), человек получал 500, а его
// имя и контакт терялись — админу уходил лишь троттлённый DM «Ошибка на
// сервере» без контакта. Резерв: любое неожиданное падение → лид админу в оба
// канала, затем исключение пробрасывается (ложного успеха быть не должно).
// Паттерн и тест-мутант — как у донатов (donation.service.create.spec.ts).
import { ConflictException, Logger } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { createBookingGuarded } from './booking.create';

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
  const notify = { alertAdminCritical: jest.fn(async () => undefined) };
  const logger = new Logger('test');
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
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
    expect(notify.alertAdminCritical).toHaveBeenCalledTimes(1);
    const [html, subject] = notify.alertAdminCritical.mock.calls[0];
    expect(html).toContain('НЕ сохранилась');
    expect(html).toContain('Мария');
    expect(html).toContain('@maria');
    expect(html).toContain('хочу разобраться с тревогой');
    expect(html).toContain("column of type 'void'");
    expect(subject).toContain('не сохранилась');
  });

  it('БД недоступна ещё до лока (сам $transaction бросает) — тоже лид админу', async () => {
    const { deps, notify } = makeDeps();
    deps.prisma.$transaction.mockRejectedValueOnce(
      new Error('connection terminated'),
    );

    await expect(createBookingGuarded(deps, {} as any, LEAD)).rejects.toThrow(
      'connection terminated',
    );
    expect(notify.alertAdminCritical).toHaveBeenCalledTimes(1);
    expect(notify.alertAdminCritical.mock.calls[0][0]).toContain(
      'connection terminated',
    );
  });

  it('слот занят (ConflictException) — ожидаемый исход: лида НЕТ, исключение как было', async () => {
    const { deps, notify } = makeDeps({ taken: true });
    await expect(
      createBookingGuarded(deps, {} as any, LEAD),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(notify.alertAdminCritical).not.toHaveBeenCalled();
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
    expect(notify.alertAdminCritical).not.toHaveBeenCalled();
  });

  it('падение самого алерта не глотает исходную ошибку и не подменяет её', async () => {
    const { deps, notify } = makeDeps({ lockError: new Error('driver boom') });
    notify.alertAdminCritical.mockRejectedValueOnce(new Error('tg down'));
    await expect(createBookingGuarded(deps, {} as any, LEAD)).rejects.toThrow(
      /driver boom|tg down/,
    );
  });
});
