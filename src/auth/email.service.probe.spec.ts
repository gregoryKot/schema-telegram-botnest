// Проба почты (src/infra/self-check/probe-email.ts) судит по снимку последней
// отправки через Postbox (src/utils/alert-email-health.ts). Письма входа и
// привязки адреса идут теми же ключами, но до 2026-11 в снимок не писали:
// отозванный ключ ломал вход по почте, а проба оставалась зелёной, пока не
// случится алерт (docs/open/security.md).
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { emailProbe } from '../infra/self-check/probe-email';
import {
  getAlertEmailHealth,
  resetAlertEmailHealth,
} from '../utils/alert-email-health';

// Заглушки, не ключи.
const KEYS = {
  POSTBOX_ACCESS_KEY_ID: 'TEST_KEY_ID',
  POSTBOX_SECRET_ACCESS_KEY: 'test-secret-not-a-real-key',
};
const env = { ...KEYS, ADMIN_EMAIL: 'owner@test.com' };

describe('EmailService.send — результат письма входа виден пробе почты', () => {
  const origEnv = { ...process.env };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    resetAlertEmailHealth();
    Object.assign(process.env, KEYS);
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    resetAlertEmailHealth();
    process.env = { ...origEnv };
  });

  it('Postbox отклонил письмо входа (403) — проба почты красная, в снимке статус ответа', async () => {
    fetchSpy.mockResolvedValue(new Response('Forbidden\n', { status: 403 }));
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
    fetchSpy.mockResolvedValue(new Response('{}', { status: 200 }));
    await new EmailService().sendLoginLink('a@test.com', 'https://x/login');
    expect(getAlertEmailHealth()).toMatchObject({ ok: true, status: null });
    const res = await emailProbe(env).run();
    expect(res).toMatchObject({ ok: true });
    expect(res.detail).toContain('последнее письмо принято');
  });
});
