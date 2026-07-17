// admin-alert.ts — последняя линия оповещения админа (Telegram → e-mail
// фолбэк). Должна: (1) никогда не бросать исключение наружу, даже если оба
// канала недоступны, (2) уважать env-конфигурацию (не слать вовсе, если
// нужных переменных нет), (3) реально падать на fetch-границе, а не
// притворяться — тестируем через мок global.fetch (паттерн из
// robokassa.service.spec.ts).
import {
  adminIdNum,
  isAdminSender,
  notifyAdminWithFallback,
} from './admin-alert';

const ORIGINAL_ENV = { ...process.env };
const originalFetch = global.fetch;

/** Мок global.fetch с реальным telegram/resend-разбором по URL. */
function mockFetch(
  handler: (url: string, init?: RequestInit) => { ok: boolean },
) {
  global.fetch = jest.fn((url: unknown, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init)),
  );
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('adminIdNum', () => {
  it('ADMIN_ID не задан → null', () => {
    delete process.env.ADMIN_ID;
    expect(adminIdNum()).toBeNull();
  });

  it('ADMIN_ID — валидное положительное число → возвращается как число', () => {
    process.env.ADMIN_ID = '123456';
    expect(adminIdNum()).toBe(123456);
  });

  it('ADMIN_ID — не число ("abc") → null', () => {
    process.env.ADMIN_ID = 'abc';
    expect(adminIdNum()).toBeNull();
  });

  it('ADMIN_ID — ноль или отрицательное → null (нужен положительный id)', () => {
    process.env.ADMIN_ID = '0';
    expect(adminIdNum()).toBeNull();
    process.env.ADMIN_ID = '-5';
    expect(adminIdNum()).toBeNull();
  });
});

describe('isAdminSender', () => {
  it('id совпадает с ADMIN_ID → true', () => {
    process.env.ADMIN_ID = '42';
    expect(isAdminSender({ id: 42 })).toBe(true);
  });

  it('id не совпадает → false', () => {
    process.env.ADMIN_ID = '42';
    expect(isAdminSender({ id: 43 })).toBe(false);
  });

  it('from не задан → false, без исключения', () => {
    process.env.ADMIN_ID = '42';
    expect(isAdminSender(undefined)).toBe(false);
  });

  it('ADMIN_ID не задан в env → false для любого отправителя', () => {
    delete process.env.ADMIN_ID;
    expect(isAdminSender({ id: 42 })).toBe(false);
  });
});

describe('notifyAdminWithFallback', () => {
  function setTelegramEnv() {
    process.env.BOT_TOKEN = 'test-token';
    process.env.ADMIN_ID = '777';
  }
  function setEmailEnv() {
    process.env.RESEND_API_KEY = 'resend-key';
    process.env.ADMIN_EMAIL = 'admin@example.com';
  }

  it('Telegram отвечает ok → email не вызывается вовсе (одна попытка)', async () => {
    setTelegramEnv();
    setEmailEnv();
    const seenUrls: string[] = [];
    mockFetch((url) => {
      seenUrls.push(url);
      return { ok: true };
    });

    await notifyAdminWithFallback('текст алерта');

    expect(seenUrls).toEqual([
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    ]);
  });

  it('Telegram отвечает ok:false → падает в email-фолбэк', async () => {
    setTelegramEnv();
    setEmailEnv();
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(url);
      return { ok: !url.includes('api.telegram.org') };
    });

    await notifyAdminWithFallback('текст алерта');

    expect(calls).toEqual([
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      'https://api.resend.com/emails',
    ]);
  });

  it('fetch в Telegram бросает (сеть недоступна) → фолбэк на email, исключение не улетает наружу', async () => {
    setTelegramEnv();
    setEmailEnv();
    let emailCalled = false;
    global.fetch = jest.fn((url: unknown) => {
      if (String(url).includes('api.telegram.org')) {
        return Promise.reject(new Error('network down'));
      }
      emailCalled = true;
      return Promise.resolve({ ok: true });
    });

    await expect(
      notifyAdminWithFallback('текст алерта'),
    ).resolves.toBeUndefined();
    expect(emailCalled).toBe(true);
  });

  it('нет ни BOT_TOKEN/ADMIN_ID, ни RESEND_API_KEY/ADMIN_EMAIL → ничего не шлёт и не падает', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    await expect(
      notifyAdminWithFallback('текст алерта'),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Telegram не настроен, но email настроен → шлёт письмо через Resend', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    setEmailEnv();
    const seenUrls: string[] = [];
    mockFetch((url) => {
      seenUrls.push(url);
      return { ok: true };
    });

    await notifyAdminWithFallback('текст алерта');

    expect(seenUrls).toEqual(['https://api.resend.com/emails']);
  });

  it('оба канала падают (fetch бросает всегда) — промис резолвится, ничего не летит наружу', async () => {
    setTelegramEnv();
    setEmailEnv();
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('both channels down')),
    );

    await expect(
      notifyAdminWithFallback('текст алерта'),
    ).resolves.toBeUndefined();
  });

  it('email: заголовки и тело содержат ключ, получателя и очищенный от HTML-тегов текст', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    setEmailEnv();
    let sentInit: RequestInit | undefined;
    global.fetch = jest.fn((_url: unknown, init?: RequestInit) => {
      sentInit = init;
      return Promise.resolve({ ok: true });
    });

    await notifyAdminWithFallback('<b>жирный</b> текст', 'Тема письма');

    const headers = sentInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer resend-key');
    const body = JSON.parse(sentInit?.body as string);
    expect(body.to).toBe('admin@example.com');
    expect(body.subject).toBe('Тема письма');
    expect(body.text).toBe('жирный текст');
  });

  it('EMAIL_FROM не задан → используется дефолтный адрес отправителя', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    delete process.env.EMAIL_FROM;
    setEmailEnv();
    let sentInit: RequestInit | undefined;
    global.fetch = jest.fn((_url: unknown, init?: RequestInit) => {
      sentInit = init;
      return Promise.resolve({ ok: true });
    });

    await notifyAdminWithFallback('текст');

    const body = JSON.parse(sentInit?.body as string);
    expect(body.from).toBe('SchemeHappens <no-reply@schemehappens.ru>');
  });
});
