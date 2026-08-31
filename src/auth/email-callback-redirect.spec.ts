// Куда уводит сбой перехода по ссылке из письма.
//
// Раньше ЛЮБОЙ сбой отправлял на «ссылка истекла». Для занятого адреса это
// неправда: ссылка жива, а адрес привязан к другому аккаунту — человек шёл
// запрашивать письмо заново и получал то же самое.
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  emailCallbackErrorUrl,
  emailCallbackSuccessUrl,
  emailCallbackNextUrl,
} from './email-callback-redirect';

const BASE = 'https://schemehappens.ru';

describe('emailCallbackErrorUrl', () => {
  it('занятый адрес — на аккаунт с честной пометкой', () => {
    expect(emailCallbackErrorUrl(new ConflictException('занят'), BASE)).toBe(
      `${BASE}/account?error=email_taken`,
    );
  });

  // КОНТРОЛЬНЫЙ случай (правило №15): новый текст не должен показываться при
  // НАСТОЯЩЕЙ просрочке — иначе исключение получилось шире, чем нужно.
  it.each(['Token expired', 'Token already used', 'Token not found'])(
    'просроченный токен (%s) — по-прежнему экран ошибки входа',
    (msg) => {
      expect(emailCallbackErrorUrl(new UnauthorizedException(msg), BASE)).toBe(
        `${BASE}/auth/error?reason=email_link_expired`,
      );
    },
  );

  it('незнакомый сбой тоже ведёт на экран ошибки, а не на аккаунт', () => {
    expect(emailCallbackErrorUrl(new Error('что угодно'), BASE)).toBe(
      `${BASE}/auth/error?reason=email_link_expired`,
    );
  });
});

describe('emailCallbackSuccessUrl', () => {
  const tokens = { accessToken: 'AT', expiresIn: 900 };

  it('привязка возвращает на аккаунт', () => {
    expect(emailCallbackSuccessUrl('link_email_auth', BASE, tokens)).toBe(
      `${BASE}/account?linked=email`,
    );
  });

  it('вход отдаёт сессию через фрагмент адреса', () => {
    const url = emailCallbackSuccessUrl('login', BASE, tokens);
    expect(url).toBe(`${BASE}/auth/callback#access_token=AT&expires_in=900`);
    // Токен во фрагменте, а не в query: фрагмент не уезжает на сервер и не
    // попадает в логи прокси.
    expect(url.split('#')[0]).not.toContain('AT');
  });
});

describe('emailCallbackNextUrl', () => {
  const tokens = { accessToken: 'AT', expiresIn: 900 };

  it('вход с билетом ведёт на сверку, а не одобряет молча', () => {
    // Фикс device-code phishing (разбор 2026-08-31): код мог подставить кто
    // угодно, поэтому подтверждает человек на /auth/confirm.
    const url = emailCallbackNextUrl('login', BASE, tokens, 'K7M2QX94');
    expect(url).toBe(
      `${BASE}/auth/confirm?code=K7M2QX94#access_token=AT&expires_in=900`,
    );
    // Код — в query (его надо сверить), токен — во фрагменте (в логи не уедет).
    expect(url.split('#')[0]).not.toContain('AT');
  });

  it('вход без билета — обычный приём сессии', () => {
    expect(emailCallbackNextUrl('login', BASE, tokens, null)).toBe(
      `${BASE}/auth/callback#access_token=AT&expires_in=900`,
    );
  });

  it('привязка адреса игнорирует билет и ведёт на аккаунт', () => {
    // link_email_auth — это не вход в контейнер, билету тут делать нечего.
    expect(
      emailCallbackNextUrl('link_email_auth', BASE, tokens, 'K7M2QX94'),
    ).toBe(`${BASE}/account?linked=email`);
  });

  it('код билета экранируется в адресе', () => {
    const url = emailCallbackNextUrl('login', BASE, tokens, 'a b&c');
    expect(url).toContain('code=a%20b%26c');
  });
});
