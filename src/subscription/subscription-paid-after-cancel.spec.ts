import {
  reportPaidAfterCancel,
  subscriptionPaidAfterCancelAlert,
} from './subscription-paid-after-cancel';
import { SUBSCRIBER_IN_EMAIL } from './subscription-owner-card';
import { PII, expectNoMarkers } from '../test-support/pii-markers';

const SUB = {
  id: 7,
  amount: 300,
  period: 'month',
  telegramId: 42n,
  email: 'a@b.ru',
};

describe('subscriptionPaidAfterCancelAlert', () => {
  it('оба канала: номер подписки, сумма, платёж и что делать; контакты — только в письме', () => {
    const { html, subject } = subscriptionPaidAfterCancelAlert(
      SUB,
      { id: 11 },
      300,
    );
    for (const text of [html.telegram, html.email]) {
      expect(text).toContain('#7');
      expect(text).toContain(
        'Оплачено: 300 ₽ (платёж #11, подписка 300 ₽/мес)',
      );
      expect(text).toContain('Верните деньги');
    }
    expect(html.email).toContain('a@b.ru');
    expect(html.email).toContain('tg:42');
    expect(html.telegram).not.toContain('a@b.ru');
    expect(html.telegram).not.toContain('tg:');
    // Контакты — отдельными строками письма, в Telegram вместо них пометка;
    // «что делать» отбит пустой строкой.
    expect(html.telegram.split('\n')).toEqual([
      expect.stringContaining('#7'),
      expect.stringContaining('Оплачено: 300 ₽'),
      SUBSCRIBER_IN_EMAIL,
      '',
      expect.stringContaining('Верните деньги'),
    ]);
    expect(html.email.split('\n')).toEqual([
      expect.stringContaining('#7'),
      expect.stringContaining('Оплачено: 300 ₽'),
      '📬 a@b.ru',
      '👤 tg:42',
      '',
      expect.stringContaining('Верните деньги'),
    ]);
    expect(subject).toBe('Деньги за подписку #7 получены, а подписка отменена');
  });

  it('email и Telegram ID из маркеров: в Telegram ни одного', () => {
    const { html } = subscriptionPaidAfterCancelAlert(
      { ...SUB, email: PII.email, telegramId: PII.telegramId },
      { id: 11 },
      300,
    );
    expectNoMarkers(html.telegram);
    expect(html.email).toContain(PII.email);
  });

  it('email в письме экранируется (его вводит подписчик)', () => {
    const { html } = subscriptionPaidAfterCancelAlert(
      { ...SUB, email: '<a href="x">y</a>' },
      { id: 1 },
      300,
    );
    expect(html.email).not.toContain('<a href');
    expect(html.email).toContain('&lt;a href');
  });

  it('пустая сумма и нет контактов: без NaN/undefined/null и лишних строк', () => {
    const { html } = subscriptionPaidAfterCancelAlert(
      { ...SUB, email: null, telegramId: null, period: 'year' },
      { id: 1 },
    );
    expect(html.telegram).toContain('сумма не указана');
    expect(html.telegram).toContain('₽/год');
    for (const text of [html.telegram, html.email]) {
      expect(text).not.toMatch(/NaN|undefined|null|tg:|📬|📧/);
      expect(text.split('\n')).toHaveLength(4); // заголовок, оплата, '', что делать
    }
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
    expect(html.telegram).toContain('#7');
    expect(subject).toContain('подписка отменена');
  });
});
