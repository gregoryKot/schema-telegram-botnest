// Регрессии на находки аудита 2026-07 (платёжный модуль):
//   P-2 — ретраи webhook Robokassa задваивали side-effects (двойной
//         meeting-линк): confirm() был check-then-act. Теперь CAS.
//   P-4 — расхождение оплаченной суммы с прайсом только алертило,
//         бронь всё равно подтверждалась. Теперь блокирует.
//   (без номера, аудит 2026-07) — mismatch и идемпотентный повтор бросали
//   ОДИНАКОВЫЙ ConflictException, PaymentController не мог их различить и
//   аккал "OK" на mismatch (глушил ретраи Robokassa на реальном фроде/
//   рассинхроне). confirm() теперь бросает отдельный подкласс
//   PaymentAmountMismatchError именно для mismatch-ветки.
import { ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingService, PaymentAmountMismatchError } from './booking.service';

function makeService(bookingRow: any) {
  const state = { row: bookingRow };
  const prisma: any = {
    booking: {
      findUnique: jest.fn(async ({ select }: any = {}) =>
        select ? { status: state.row.status } : state.row,
      ),
      // CAS: имитируем реальную семантику updateMany по статусу
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (state.row.status !== where.status) return { count: 0 };
        Object.assign(state.row, data);
        return { count: 1 };
      }),
    },
  };
  const notify = {
    onConfirmed: jest.fn(async () => undefined),
    alertAdmin: jest.fn(async () => undefined),
  };
  const pricing = { getPrice: jest.fn(async () => 4000) };
  const config = { get: () => undefined };
  const service = new BookingService(
    prisma,
    notify as any,
    {} as any,
    {} as any,
    pricing as any,
    config as any,
  );
  return { service, prisma, notify, state };
}

describe('BookingService.confirm — идемпотентность и сверка суммы', () => {
  const held = () => ({
    id: 7,
    status: BookingStatus.HELD,
    type: 'SESSION_50',
    startsAt: new Date(),
    durationMin: 50,
  });

  it('подтверждает HELD-бронь и шлёт уведомление один раз', async () => {
    const { service, notify } = makeService(held());
    await expect(service.confirm(7, 4000)).resolves.toEqual({ ok: true });
    expect(notify.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('повторный webhook по уже подтверждённой броне — идемпотентный ok БЕЗ повторного уведомления', async () => {
    const { service, notify } = makeService(held());
    await service.confirm(7, 4000);
    await expect(service.confirm(7, 4000)).resolves.toEqual({ ok: true });
    expect(notify.onConfirmed).toHaveBeenCalledTimes(1); // не задвоилось
  });

  it('расхождение суммы блокирует подтверждение (бронь остаётся HELD) и алертит', async () => {
    const { service, notify, state } = makeService(held());
    await expect(service.confirm(7, 1)).rejects.toThrow(ConflictException);
    expect(state.row.status).toBe(BookingStatus.HELD);
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
    expect(notify.onConfirmed).not.toHaveBeenCalled();
  });

  it('расхождение суммы бросает именно PaymentAmountMismatchError — отличимо от идемпотентного ConflictException, чтобы PaymentController не ответил Robokassa "OK" на mismatch', async () => {
    const { service } = makeService(held());
    await expect(service.confirm(7, 1)).rejects.toThrow(
      PaymentAmountMismatchError,
    );
  });

  it('прочие статус-конфликты (например CANCELLED) — обычный ConflictException, а НЕ PaymentAmountMismatchError', async () => {
    const { service } = makeService({
      ...held(),
      status: BookingStatus.CANCELLED,
    });
    await expect(service.confirm(7, 4000)).rejects.not.toBeInstanceOf(
      PaymentAmountMismatchError,
    );
  });

  it('CANCELLED-бронь подтвердить нельзя', async () => {
    const row = { ...held(), status: BookingStatus.CANCELLED };
    const { service } = makeService(row);
    await expect(service.confirm(7, 4000)).rejects.toThrow(ConflictException);
  });
});
