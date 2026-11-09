// Проба почты (src/infra/self-check/probe-email.ts) судит по снимку последней
// отправки через Resend (src/utils/alert-email-health.ts). Письма входа и
// привязки адреса идут тем же ключом, но до 2026-11 в снимок не писали:
// отозванный ключ ломал вход по почте, а проба оставалась зелёной, пока не
// случится алерт (docs/open/security.md).
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { emailProbe } from '../infra/self-check/probe-email';
import {
  getAlertEmailHealth,
  resetAlertEmailHealth,
} from '../utils/alert-email-health';

const env = { RESEND_API_KEY: 'test-key', ADMIN_EMAIL: 'owner@test.com' };

describe('EmailService.send — результат письма входа виден пробе почты', () => {
  const origKey = process.env.RESEND_API_KEY;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    resetAlertEmailHealth();
    process.env.RESEND_API_KEY = 'test-key';
    fetchSpy = jest.spyOn(global, 'fetch' as any);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    resetAlertEmailHealth();
    if (origKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = origKey;
  });

  it('Resend отклонил письмо входа (403) — проба почты красная, в снимке статус ответа', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'API key is invalid',
    } as any);
    await expect(
      new EmailService().sendLoginLink('a@test.com', 'https://x/login?t=1'),
    ).rejects.toThrow('Email delivery failed');

    expect(getAlertEmailHealth()).toMatchObject({ ok: false, status: 403 });
    const res = await emailProbe(env).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('HTTP 403');
  });

  it('сеть не ответила на письмо привязки адреса — в снимке «сеть», а не статус', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      new EmailService().sendLinkEmailLetter('a@test.com', 'https://x/l'),
    ).rejects.toThrow('Email delivery failed');
    expect(getAlertEmailHealth()).toMatchObject({
      ok: false,
      status: 'network',
    });
  });

  it('принятое письмо входа — снимок зелёный, проба видит удачную отправку', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as any);
    await new EmailService().sendLoginLink('a@test.com', 'https://x/login');
    expect(getAlertEmailHealth()).toMatchObject({ ok: true, status: null });
    const res = await emailProbe(env).run();
    expect(res).toMatchObject({ ok: true });
    expect(res.detail).toContain('последнее письмо принято');
  });
});
