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
import { PaymentAfterCancelError } from './booking.transitions';

function makeService(bookingRow: any) {
  const state = { row: bookingRow };
  const prisma: any = {
    booking: {
      findUnique: jest.fn(async ({ select }: any = {}) =>
        select ? { status: state.row.status } : state.row,
      ),
      // CAS: имитируем реальную семантику updateMany по WHERE (статус, paidAt)
      updateMany: jest.fn(async ({ where, data }: any) => {
        if ('status' in where && state.row.status !== where.status)
          return { count: 0 };
        if ('paidAt' in where && (state.row.paidAt ?? null) !== where.paidAt)
          return { count: 0 };
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
    { claimRun: jest.fn().mockResolvedValue(true) } as any,
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

  it('COMPLETED + вебхук с суммой — обычный ConflictException (поздний повтор), не «оплата после отмены»', async () => {
    const { service, state } = makeService({
      ...held(),
      status: BookingStatus.COMPLETED,
    });
    const err = await service.confirm(7, 4000).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err).not.toBeInstanceOf(PaymentAfterCancelError);
    expect(state.row.paidAt).toBeUndefined();
  });
});

// Аудит 2026-10-11, P1: оплата после истечения холда/отмены отвечала Robokassa
// «OK» с одним warn — деньги списаны, брони нет, владелец не знает.
describe('BookingService.confirm — paidAt и оплата по отменённой броне', () => {
  const row = (status: BookingStatus) => ({
    id: 7,
    status,
    type: 'SESSION_50',
    startsAt: new Date(),
    durationMin: 50,
    clientName: 'Мария',
    clientContact: '@maria',
  });

  it('оплата вебхуком: тот же CAS ставит paidAt вместе со статусом', async () => {
    const { service, state, prisma } = makeService(row(BookingStatus.HELD));
    await service.confirm(7, 4000);
    expect(state.row.status).toBe(BookingStatus.CONFIRMED);
    expect(state.row.paidAt).toBeInstanceOf(Date);
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
  });

  it('ручное подтверждение админом (без суммы) — paidAt НЕ ставится: это не оплата', async () => {
    const { service, state } = makeService(row(BookingStatus.HELD));
    await service.confirm(7);
    expect(state.row.status).toBe(BookingStatus.CONFIRMED);
    expect(state.row.paidAt).toBeUndefined();
  });

  it('повтор по CONFIRMED не перезаписывает paidAt', async () => {
    const { service, state } = makeService(row(BookingStatus.HELD));
    await service.confirm(7, 4000);
    const first = state.row.paidAt;
    await new Promise((r) => setTimeout(r, 5));
    await service.confirm(7, 4000);
    expect(state.row.paidAt).toBe(first);
  });

  it('CANCELLED + верная оплата: paidAt записан ДО броска, PaymentAfterCancelError несёт расшифрованную бронь и сумму', async () => {
    const { service, state, notify } = makeService(
      row(BookingStatus.CANCELLED),
    );
    let paidAtAtThrow: unknown;
    const err = await service.confirm(7, 4000).catch((e) => {
      paidAtAtThrow = state.row.paidAt;
      return e;
    });
    expect(err).toBeInstanceOf(PaymentAfterCancelError);
    expect(err).toBeInstanceOf(ConflictException); // старые catch(Conflict) не ломаются
    expect(err.paidAmount).toBe(4000);
    expect(err.booking).toMatchObject({ id: 7, clientName: 'Мария' });
    expect(paidAtAtThrow).toBeInstanceOf(Date);
    expect(state.row.status).toBe(BookingStatus.CANCELLED); // бронь не воскрешаем
    expect(notify.onConfirmed).not.toHaveBeenCalled();
  });

  it('CANCELLED + повторная доставка: paidAt остаётся первым, ошибка снова', async () => {
    const { service, state } = makeService(row(BookingStatus.CANCELLED));
    await service.confirm(7, 4000).catch(() => null);
    const first = state.row.paidAt;
    await new Promise((r) => setTimeout(r, 5));
    await expect(service.confirm(7, 4000)).rejects.toBeInstanceOf(
      PaymentAfterCancelError,
    );
    expect(state.row.paidAt).toBe(first);
  });

  it('CANCELLED + сумма не сошлась — по-прежнему PaymentAmountMismatchError (FAIL), paidAt не ставится', async () => {
    const { service, state } = makeService(row(BookingStatus.CANCELLED));
    await expect(service.confirm(7, 1)).rejects.toBeInstanceOf(
      PaymentAmountMismatchError,
    );
    expect(state.row.paidAt).toBeUndefined();
  });

  it('CANCELLED + ручное подтверждение админом (без суммы) — обычный ConflictException без paidAt', async () => {
    const { service, state } = makeService(row(BookingStatus.CANCELLED));
    const err = await service.confirm(7).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err).not.toBeInstanceOf(PaymentAfterCancelError);
    expect(state.row.paidAt).toBeUndefined();
  });
});
