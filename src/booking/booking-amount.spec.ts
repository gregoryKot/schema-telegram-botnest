// assertPaidAmount: сверка суммы вебхука со счётом брони. Бронь не в рублях —
// онлайн-счёт на неё не выставлялся, любая оплата — расхождение (решение
// владельца 2026-10-20). Рублёвая сверка (сумма из брони, а не текущая цена)
// покрыта в booking.payment.spec.ts и e2e test/booking-amount.e2e-spec.ts.
import { SessionType } from '@prisma/client';
import { assertPaidAmount, PaymentAmountMismatchError } from './booking-amount';

function deps(price = 4000) {
  return {
    pricing: { getPrice: jest.fn(async () => price) },
    notify: { alertAdmin: jest.fn(async () => undefined) },
  };
}
const booking = (amount: number | null, currency?: string) => ({
  id: 7,
  type: SessionType.SESSION_50,
  amount,
  currency,
});

describe('assertPaidAmount — бронь не в рублях', () => {
  it.each(['ILS', 'EUR', 'USD'])(
    '%s: даже «сошедшаяся» сумма — расхождение, владельцу сигнал, бронь не подтверждена',
    async (currency) => {
      const d = deps();
      await expect(
        assertPaidAmount(d, booking(70, currency), 70),
      ).rejects.toBeInstanceOf(PaymentAmountMismatchError);
      expect(d.notify.alertAdmin).toHaveBeenCalledTimes(1);
      const [text] = d.notify.alertAdmin.mock.calls[0] as unknown as [string];
      expect(text).toContain('#7');
      expect(text).toContain(`70 ${currency}`);
      expect(text).toContain('НЕ подтверждена');
      expect(d.pricing.getPrice).not.toHaveBeenCalled();
    },
  );

  it('рубли (и бронь без поля валюты) — прежняя сверка: сошлось, тихо', async () => {
    for (const currency of ['RUB', undefined]) {
      const d = deps();
      await expect(
        assertPaidAmount(d, booking(4000, currency), 4000),
      ).resolves.toBeUndefined();
      expect(d.notify.alertAdmin).not.toHaveBeenCalled();
    }
  });

  it('контроль: рубли с другой суммой — по-прежнему расхождение рублёвым текстом', async () => {
    const d = deps();
    await expect(
      assertPaidAmount(d, booking(4000, 'RUB'), 1),
    ).rejects.toBeInstanceOf(PaymentAmountMismatchError);
    const [text] = d.notify.alertAdmin.mock.calls[0] as unknown as [string];
    expect(text).toContain('сумма расходится');
    expect(text).toContain('Выставлен счёт на 4000 ₽');
  });
});
