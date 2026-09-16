import {
  emailProbe,
  alertsProbe,
  oauthRedirectsProbe,
} from './probe-capabilities';

describe('emailProbe', () => {
  it('RESEND_API_KEY + ADMIN_EMAIL заданы — ok, «настроено»', async () => {
    const res = await emailProbe({
      RESEND_API_KEY: 'key',
      ADMIN_EMAIL: 'a@b.ru',
    }).run();
    expect(res).toEqual({
      ok: true,
      detail: expect.stringContaining('настроено'),
    });
  });

  it('не заданы — всё равно ok (резервный канал, это не авария сама по себе)', async () => {
    const res = await emailProbe({}).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('не настроено');
  });
});

describe('alertsProbe', () => {
  it('хотя бы один канал (Telegram) настроен — ok', async () => {
    const probe = alertsProbe({ BOT_TOKEN: 'tok', ADMIN_ID: '1' });
    expect(probe.critical).toBe(true);
    const res = await probe.run();
    expect(res.ok).toBe(true);
  });

  it('ни один канал не настроен — не ok', async () => {
    const res = await alertsProbe({}).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('никуда не уходят');
  });
});

describe('oauthRedirectsProbe', () => {
  it('ничего не настроено — ok (нечего проверять)', async () => {
    const res = await oauthRedirectsProbe({}).run();
    expect(res.ok).toBe(true);
  });

  it('редирект ведёт на перенаправляемый (legacy) хост — не ok', async () => {
    const res = await oauthRedirectsProbe({
      GOOGLE_REDIRECT_URI: 'https://schemalab.ru/api/auth/google/callback',
    }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('GOOGLE_REDIRECT_URI');
  });

  it('канонический адрес возврата — ok (контроль)', async () => {
    const res = await oauthRedirectsProbe({
      GOOGLE_REDIRECT_URI: 'https://schemehappens.ru/api/auth/google/callback',
    }).run();
    expect(res.ok).toBe(true);
  });
});
