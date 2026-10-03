// A3: отскок для ссылки привязки почты (strict-кука не едет на переход с чужого сайта).
import type { Request, Response } from 'express';
import { sendBounce, shouldBounce } from './email-link-bounce';

const req = (headers: Record<string, string>, query: Record<string, unknown>) =>
  ({ headers, query }) as unknown as Request;

describe('shouldBounce', () => {
  it('cross-site без b → да', () => {
    expect(shouldBounce(req({ 'sec-fetch-site': 'cross-site' }, {}))).toBe(
      true,
    );
  });
  it('после отскока (b=1) → нет: без цикла', () => {
    expect(
      shouldBounce(req({ 'sec-fetch-site': 'cross-site' }, { b: '1' })),
    ).toBe(false);
  });
  it.each(['same-origin', 'same-site', 'none'])('%s → нет', (v) => {
    expect(shouldBounce(req({ 'sec-fetch-site': v }, {}))).toBe(false);
  });
  it('нет заголовка (старый браузер) → нет', () => {
    expect(shouldBounce(req({}, {}))).toBe(false);
  });
});

describe('sendBounce', () => {
  function run(
    query: Record<string, unknown>,
    base = 'https://schemehappens.ru/',
  ) {
    const res = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    sendBounce(req({}, query), res as unknown as Response, base);
    return { res, html: res.send.mock.calls[0][0] as string };
  }

  it('meta-refresh на тот же колбэк со своей страницы + b=1, без двойного слэша', () => {
    const { html } = run({ token: 'abc', ticket: 'K7M2QX94' });
    expect(html).toContain(
      'content="0;url=https://schemehappens.ru/api/auth/email/callback?token=abc&amp;ticket=K7M2QX94&amp;b=1"',
    );
  });

  it('не кэшируется и не светит адрес реферером', () => {
    const { res } = run({ token: 'abc' });
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      }),
    );
  });

  it('значения из query не ломают HTML-атрибут (инъекция)', () => {
    const { html } = run({ token: '"><script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/url=[^"]*"[^>]*>\s*<script/);
  });

  it('чужие параметры не переносятся', () => {
    const { html } = run({ token: 'abc', evil: 'x' });
    expect(html).not.toContain('evil');
  });
});
