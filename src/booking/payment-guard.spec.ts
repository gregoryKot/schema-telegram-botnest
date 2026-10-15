// Аудит 2026-10-11: `robokassa.enabled=false` везде значило «dev: подтвердить
// без денег» — и в проде тоже. Гард разводит три режима и в проде без
// Robokassa отказывает 503, а не подтверждает платное бесплатно.
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import {
  assertBookingPayable,
  assertPaymentAvailable,
  paymentMode,
  refusePayment,
} from './payment-guard';

const on = { enabled: true };
const off = { enabled: false };

describe('paymentMode — матрица enabled × NODE_ENV', () => {
  it.each([
    [true, 'production', 'live'],
    [true, 'test', 'live'],
    [true, undefined, 'live'],
    [false, 'production', 'refuse'],
    [false, 'test', 'dev'],
    [false, 'development', 'dev'],
    [false, undefined, 'dev'],
  ])('enabled=%s, NODE_ENV=%s → %s', (enabled, nodeEnv, mode) => {
    expect(paymentMode({ enabled }, nodeEnv)).toBe(mode);
  });

  it('NODE_ENV читается в момент вызова, а не при загрузке модуля', () => {
    const was = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(paymentMode(off)).toBe('refuse');
      process.env.NODE_ENV = 'test';
      expect(paymentMode(off)).toBe('dev');
    } finally {
      process.env.NODE_ENV = was;
    }
  });
});

describe('refusePayment', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => errorSpy.mockRestore());

  it('бросает 503 PAYMENT_UNAVAILABLE', () => {
    expect.assertions(2);
    try {
      refusePayment('donation');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      expect((e as ServiceUnavailableException).message).toBe(
        'PAYMENT_UNAVAILABLE',
      );
    }
  });

  it('пишет error со стабильным текстом без цифр (троттлинг AlertLogger по тексту)', () => {
    expect(() => refusePayment('booking')).toThrow();
    const text = String(errorSpy.mock.calls[0][0]);
    expect(text).toBe(
      'Robokassa not configured in production: booking refused',
    );
    expect(text).not.toMatch(/\d/);
  });
});

describe('assertPaymentAvailable', () => {
  const was = process.env.NODE_ENV;
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => {
    process.env.NODE_ENV = was;
    errorSpy.mockRestore();
  });

  it('прод без Robokassa → 503', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertPaymentAvailable(off, 'subscription')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('прод с Robokassa и не-прод без неё → проходит молча', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertPaymentAvailable(on, 'donation')).not.toThrow();
    process.env.NODE_ENV = 'test';
    expect(() => assertPaymentAvailable(off, 'donation')).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('assertBookingPayable', () => {
  const was = process.env.NODE_ENV;
  const lead = {
    clientName: 'Мария',
    clientContact: '@maria',
    startsAt: new Date('2026-10-20T10:00:00Z'),
    durationMin: 50,
    type: SessionType.SESSION_50,
  };
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => {
    process.env.NODE_ENV = was;
    errorSpy.mockRestore();
  });

  it('прод без Robokassa: платная запись → лид владельцу (имя, контакт) и 503', async () => {
    process.env.NODE_ENV = 'production';
    const notify = { notifyAdminBoth: jest.fn(async () => undefined) };
    await expect(assertBookingPayable(off, notify, lead)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    const [html, subject] = notify.notifyAdminBoth.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(html).toContain('Мария');
    expect(html).toContain('@maria');
    expect(html).toContain('оплата не настроена');
    expect(subject).toContain('Заявка на запись не сохранилась');
  });

  it('контроль: бесплатное знакомство в том же окружении не затрагивается', async () => {
    process.env.NODE_ENV = 'production';
    const notify = { notifyAdminBoth: jest.fn(async () => undefined) };
    await expect(
      assertBookingPayable(off, notify, {
        ...lead,
        type: SessionType.INTRO_15,
        durationMin: 15,
      }),
    ).resolves.toBeUndefined();
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  it('контроль: Robokassa настроена, либо не прод → лид не шлётся', async () => {
    const notify = { notifyAdminBoth: jest.fn(async () => undefined) };
    process.env.NODE_ENV = 'production';
    await expect(
      assertBookingPayable(on, notify, lead),
    ).resolves.toBeUndefined();
    process.env.NODE_ENV = 'test';
    await expect(
      assertBookingPayable(off, notify, lead),
    ).resolves.toBeUndefined();
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });
});
