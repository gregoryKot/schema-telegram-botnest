import {
  reportPaidAfterCancel,
  subscriptionPaidAfterCancelAlert,
} from './subscription-paid-after-cancel';

const SUB = {
  id: 7,
  amount: 300,
  period: 'month',
  telegramId: 42n,
  email: 'a@b.ru',
};

describe('subscriptionPaidAfterCancelAlert', () => {
  it('содержит номер подписки, сумму, платёж, контакты и что делать', () => {
    const { html, subject } = subscriptionPaidAfterCancelAlert(
      SUB,
      { id: 11 },
      300,
    );
    expect(html).toContain('#7');
    expect(html).toContain('Оплачено: 300 ₽ (платёж #11, подписка 300 ₽/мес)');
    expect(html).toContain('a@b.ru');
    expect(html).toContain('tg:42');
    expect(html).toContain('Верните деньги');
    expect(subject).toBe('Деньги за подписку #7 получены, а подписка отменена');
  });

  it('email экранируется (его вводит подписчик, уходит как HTML)', () => {
    const { html } = subscriptionPaidAfterCancelAlert(
      { ...SUB, email: '<a href="x">y</a>' },
      { id: 1 },
      300,
    );
    expect(html).not.toContain('<a href');
    expect(html).toContain('&lt;a href');
  });

  it('пустая сумма и нет контактов: без NaN/undefined/null и лишних строк', () => {
    const { html } = subscriptionPaidAfterCancelAlert(
      { ...SUB, email: null, telegramId: null, period: 'year' },
      { id: 1 },
    );
    expect(html).toContain('сумма не указана');
    expect(html).toContain('₽/год');
    expect(html).not.toMatch(/NaN|undefined|null|tg:|📬/);
  });
});

describe('reportPaidAfterCancel', () => {
  it('пишет warn (не error) и отправляет в оба канала один раз', async () => {
    const notify = { notifyAdminBoth: jest.fn(async () => {}) };
    const logger: any = { warn: jest.fn(), error: jest.fn() };
    await reportPaidAfterCancel({ notify, logger }, SUB, { id: 11 }, 300);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Subscription 7: оплата после отмены, charge 11',
    );
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    const [html, subject] = notify.notifyAdminBoth.mock.calls[0] as any[];
    expect(html).toContain('#7');
    expect(subject).toContain('подписка отменена');
  });
});
