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
    expect(emailCallbackRedirectUrl(BASE, 'abc_DEF-123', undefined)).toBe(
      `${BASE}${EMAIL_CONSUME_PATH}?${EMAIL_CONSUME_PARAM}=abc_DEF-123`,
    );
  });

  it('билет входа едет следом', () => {
    expect(emailCallbackRedirectUrl(BASE, 't', 'AbCd1234')).toBe(
      `${BASE}/auth/callback?email_token=t&ticket=AbCd1234`,
    );
  });

  it('токен кодируется — лишние символы не ломают адрес и не добавляют параметров', () => {
    const url = emailCallbackRedirectUrl(BASE, 'a&b=c#d', undefined);
    expect(url).toBe(`${BASE}/auth/callback?email_token=a%26b%3Dc%23d`);
    expect(new URL(url).searchParams.get('email_token')).toBe('a&b=c#d');
  });

  it('завершающий слэш базы не удваивается', () => {
    expect(emailCallbackRedirectUrl(`${BASE}/`, 't', undefined)).toBe(
      `${BASE}/auth/callback?email_token=t`,
    );
  });

  it('без токена — экран ошибки входа, а не пустая страница-погашение', () => {
    expect(emailCallbackRedirectUrl(BASE, undefined, 'AbCd1234')).toBe(
      `${BASE}/auth/error?reason=email_link_expired`,
    );
    expect(emailCallbackRedirectUrl(BASE, '', undefined)).toBe(
      `${BASE}/auth/error?reason=email_link_expired`,
    );
  });
});
