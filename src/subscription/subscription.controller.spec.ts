// SubscriptionController был на 0% покрытия. Инстанцируем напрямую с
// фейком SubscriptionService (см. паттерн booking/payment.controller.spec.ts).
import { BadRequestException } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';

function makeController() {
  const subs = {
    isEnabled: jest.fn(() => true),
    getOptions: jest.fn(() =>
      Promise.resolve([
        { period: 'month', price: 300 },
        { period: 'year', price: 3000 },
      ]),
    ),
    subscribe: jest.fn(() =>
      Promise.resolve({
        id: 1,
        cancelToken: 'ct-1',
        paymentUrl: 'https://robokassa.test/pay',
      }),
    ),
    getPublicByToken: jest.fn(() =>
      Promise.resolve({
        status: 'active',
        period: 'month',
        amount: 300,
        nextChargeAt: null,
      }),
    ),
    cancel: jest.fn(() => Promise.resolve({ ok: true })),
  };
  const controller = new SubscriptionController(subs as any);
  return { controller, subs };
}

describe('SubscriptionController.options', () => {
  it('возвращает enabled + список опций', async () => {
    const { controller, subs } = makeController();
    const res = await controller.options();
    expect(res).toEqual({
      enabled: true,
      options: [
        { period: 'month', price: 300 },
        { period: 'year', price: 3000 },
      ],
    });
    expect(subs.getOptions).toHaveBeenCalledTimes(1);
  });
});

describe('SubscriptionController.subscribe', () => {
  it('honeypot заполнен → BadRequestException, сервис не вызывается', async () => {
    const { controller, subs } = makeController();
    await expect(
      controller.subscribe({
        period: 'month',
        acceptedOffer: true,
        website: 'i-am-a-bot',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(subs.subscribe).not.toHaveBeenCalled();
  });

  it('нормальный запрос → делегирует в сервис, period по умолчанию "month"', async () => {
    const { controller, subs } = makeController();
    const res = await controller.subscribe({ acceptedOffer: true });
    expect(subs.subscribe).toHaveBeenCalledWith({
      period: 'month',
      email: undefined,
      acceptedOffer: true,
    });
    expect(res.cancelToken).toBe('ct-1');
  });

  it('period="year" передаётся как есть', async () => {
    const { controller, subs } = makeController();
    await controller.subscribe({ period: 'year', acceptedOffer: true });
    expect(subs.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ period: 'year' }),
    );
  });

  it('email тримится, пустая строка превращается в undefined', async () => {
    const { controller, subs } = makeController();
    await controller.subscribe({
      period: 'month',
      email: '   ',
      acceptedOffer: true,
    });
    expect(subs.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined }),
    );

    await controller.subscribe({
      period: 'month',
      email: '  a@b.ru  ',
      acceptedOffer: true,
    });
    expect(subs.subscribe).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: 'a@b.ru' }),
    );
  });
});

describe('SubscriptionController.getByToken', () => {
  it('делегирует в getPublicByToken с токеном из URL', async () => {
    const { controller, subs } = makeController();
    await controller.getByToken('tok-42');
    expect(subs.getPublicByToken).toHaveBeenCalledWith('tok-42');
  });
});

describe('SubscriptionController.cancel', () => {
  it('делегирует в cancel сервиса с токеном из URL', async () => {
    const { controller, subs } = makeController();
    await controller.cancel('tok-42');
    expect(subs.cancel).toHaveBeenCalledWith('tok-42');
  });
});
