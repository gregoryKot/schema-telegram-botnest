// GET /api/auth/email/callback только перенаправляет — токен не гасит
// (B-14 аудита 2026-10).
import {
  EMAIL_CONSUME_PARAM,
  EMAIL_CONSUME_PATH,
  emailCallbackRedirectUrl,
} from './email-callback-redirect';

const BASE = 'https://schemehappens.ru';

describe('emailCallbackRedirectUrl', () => {
  it('уводит на страницу-погашение с токеном в query', () => {
    expect(emailCallbackRedirectUrl(BASE, 'abc_DEF-123')).toBe(
      `${BASE}${EMAIL_CONSUME_PATH}?${EMAIL_CONSUME_PARAM}=abc_DEF-123`,
    );
  });

  it('токен кодируется — лишние символы не ломают адрес и не добавляют параметров', () => {
    const url = emailCallbackRedirectUrl(BASE, 'a&b=c#d');
    expect(url).toBe(`${BASE}/auth/callback?email_token=a%26b%3Dc%23d`);
    expect(new URL(url).searchParams.get('email_token')).toBe('a&b=c#d');
  });

  it('завершающий слэш базы не удваивается', () => {
    expect(emailCallbackRedirectUrl(`${BASE}/`, 't')).toBe(
      `${BASE}/auth/callback?email_token=t`,
    );
  });

  it.each([undefined, '', ['a', 'b']])(
    'нет токена или он не строка (%j) — экран ошибки, а не пустая страница-погашение',
    (raw) => {
      expect(emailCallbackRedirectUrl(BASE, raw)).toBe(
        `${BASE}/auth/error?reason=email_link_expired`,
      );
    },
  );
});
