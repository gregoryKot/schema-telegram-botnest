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
import {
  getAlertEmailHealth,
  resetAlertEmailHealth,
} from './alert-email-health';
import { Logger } from '@nestjs/common';
import { loadRecordedFixture } from '../test-support/recorded-fixture';

const ORIGINAL_ENV = { ...process.env };
const originalFetch = global.fetch;
const POSTBOX = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';
// Заглушки, не ключи: настоящих значений в репозитории нет.
const POSTBOX_SECRET = 'test-secret-not-a-real-key';
function setPostboxEnv() {
  process.env.POSTBOX_ACCESS_KEY_ID = 'TEST_KEY_ID';
  process.env.POSTBOX_SECRET_ACCESS_KEY = POSTBOX_SECRET;
  process.env.ADMIN_EMAIL = 'admin@example.com';
}

/** Мок global.fetch с реальным telegram/postbox-разбором по URL. */
function mockFetch(
  handler: (url: string, init?: RequestInit) => { ok: boolean },
) {
  global.fetch = jest.fn((url: unknown, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init)),
  );
}

afterEach(() => {
  resetAlertEmailHealth();
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
  const setEmailEnv = setPostboxEnv;

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
      POSTBOX,
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

  it('нет ни BOT_TOKEN/ADMIN_ID, ни ключей Postbox/ADMIN_EMAIL → ничего не шлёт и не падает', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    delete process.env.POSTBOX_ACCESS_KEY_ID;
    delete process.env.POSTBOX_SECRET_ACCESS_KEY;
    delete process.env.ADMIN_EMAIL;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    await expect(
      notifyAdminWithFallback('текст алерта'),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Подпись запроса собирается из пары ключей: с одним письмо не отправить.
  it.each(['POSTBOX_ACCESS_KEY_ID', 'POSTBOX_SECRET_ACCESS_KEY'])(
    'Telegram не настроен, из ключей Postbox нет %s → письмо не шлётся',
    async (missing) => {
      delete process.env.BOT_TOKEN;
      delete process.env.ADMIN_ID;
      setEmailEnv();
      delete process.env[missing];
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      await expect(
        notifyAdminWithFallback('текст алерта'),
      ).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('Telegram не настроен, но email настроен → шлёт письмо через Postbox', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    setEmailEnv();
    const seenUrls: string[] = [];
    mockFetch((url) => {
      seenUrls.push(url);
      return { ok: true };
    });

    await notifyAdminWithFallback('текст алерта');

    expect(seenUrls).toEqual([POSTBOX]);
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

  it('email: запрос подписан ключом, в теле получатель и очищенный от HTML-тегов текст', async () => {
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
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=TEST_KEY_ID\/\d{8}\/ru-central1\/ses\/aws4_request, /,
    );
    expect(headers.authorization).not.toContain(POSTBOX_SECRET);
    const body = JSON.parse(sentInit?.body as string);
    expect(body.Destination.ToAddresses).toEqual(['admin@example.com']);
    expect(body.Content.Simple.Subject.Data).toBe('Тема письма');
    expect(body.Content.Simple.Body.Text.Data).toBe('жирный текст');
  });

  // Отправитель по умолчанию — тот же, что у писем пользователям (раньше у
  // алертов был свой, «SchemeHappens <…>»): один DEFAULT_EMAIL_FROM транспорта.
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
    expect(body.FromEmailAddress).toBe(
      'Schema Happens <no-reply@schemehappens.ru>',
    );
  });

  describe('skipTelegram', () => {
    it('минует Telegram и пишет сразу почтой', async () => {
      // Инцидент 2026-08-09: алерт «Telegram не отвечает» уходил в Telegram.
      process.env.BOT_TOKEN = 'bot-token';
      process.env.ADMIN_ID = '42';
      setPostboxEnv();
      const fetchMock = jest
        .fn()
        .mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
      global.fetch = fetchMock;

      await notifyAdminWithFallback('канал молчит', 'Канал', {
        skipTelegram: true,
      });

      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls).toEqual([POSTBOX]);
    });
  });
});

// Аудит 2026-10-11: sendEmail не смотрел ответ площадки — отозванный ключ, 403
// и 429 считались доставкой и не оставляли ни строки в логе.
describe('Postbox не принял письмо', () => {
  const SECRET_TEXT = 'секретный текст алерта admin@example.com';
  // Тело отказа называет адрес: в лог оно попасть не должно.
  const refused = (status: number) => () =>
    Promise.resolve(
      new Response('{"message":"bad admin@example.com"}', { status }),
    );

  function setup(postbox: () => Promise<unknown>) {
    process.env.BOT_TOKEN = 'tg-token';
    process.env.ADMIN_ID = '777';
    setPostboxEnv();
    global.fetch = jest.fn((url: unknown) =>
      String(url).includes('api.telegram.org')
        ? Promise.resolve({ ok: false, status: 500 })
        : postbox(),
    );
    return {
      warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
      error: jest.spyOn(Logger.prototype, 'error').mockImplementation(),
    };
  }

  it.each([401, 403, 422, 429, 500])(
    'HTTP %i: снимок не ok со статусом, warn без секретов, error не зовётся',
    async (status) => {
      const { warn, error } = setup(refused(status));

      await expect(
        notifyAdminWithFallback(SECRET_TEXT),
      ).resolves.toBeUndefined();

      expect(getAlertEmailHealth()).toMatchObject({ ok: false, status });
      expect(warn).toHaveBeenCalledTimes(1);
      const line = String(warn.mock.calls[0][0]);
      expect(line).toContain(`HTTP ${status}`);
      expect(line).not.toContain(POSTBOX_SECRET);
      expect(line).not.toContain('admin@example.com');
      expect(line).not.toContain('секретный');
      // error ушёл бы через AlertLogger обратно в этот же фолбэк
      expect(error).not.toHaveBeenCalled();
    },
  );

  it('серия одинаковых отказов — одна строка в логе', async () => {
    const { warn } = setup(refused(403));
    await notifyAdminWithFallback('a');
    await notifyAdminWithFallback('b');
    await notifyAdminWithFallback('c');
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([
      'Резервный канал алертов (Postbox) не принял письмо: HTTP 403',
    ]);
  });

  it('сеть недоступна: status network, не бросает', async () => {
    const { warn } = setup(() => Promise.reject(new Error('ECONNRESET')));
    await expect(notifyAdminWithFallback('x')).resolves.toBeUndefined();
    expect(getAlertEmailHealth()).toMatchObject({
      ok: false,
      status: 'network',
    });
    expect(String(warn.mock.calls[0][0])).toContain('сеть');
  });

  it('таймаут (TimeoutError): status timeout', async () => {
    const { warn } = setup(() =>
      Promise.reject(new DOMException('timed out', 'TimeoutError')),
    );
    await notifyAdminWithFallback('x');
    expect(getAlertEmailHealth()).toMatchObject({
      ok: false,
      status: 'timeout',
    });
    expect(String(warn.mock.calls[0][0])).toContain('таймаут');
  });

  it('принятое письмо: снимок ok, warn не зовётся', async () => {
    const { warn } = setup(() => Promise.resolve({ ok: true, status: 200 }));
    await notifyAdminWithFallback('x');
    expect(getAlertEmailHealth()).toMatchObject({ ok: true, status: null });
    expect(getAlertEmailHealth().lastOkAt).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

// Аудит 2026-10 (#812): последняя линия алерта не слушала 429 — на «слишком
// часто» сразу уходила в почту, хотя через пять секунд Telegram принял бы.
describe('notifyAdminWithFallback — ответ Telegram 429', () => {
  const TG = 'https://api.telegram.org/bottest-token/sendMessage';
  const body429 = (retryAfter: number) => {
    const body = JSON.parse(
      loadRecordedFixture('telegram-429-too-many-requests.json'),
    );
    body.parameters.retry_after = retryAfter;
    return body;
  };
  function mockTelegram(responses: Array<{ ok: boolean; body?: unknown }>) {
    const calls: string[] = [];
    global.fetch = jest.fn((url: unknown) => {
      calls.push(String(url));
      const r = String(url).startsWith(TG)
        ? (responses.shift() ?? { ok: true })
        : { ok: true };
      return Promise.resolve({
        ok: r.ok,
        status: r.ok ? 200 : 429,
        json: () => Promise.resolve(r.body),
      } as Response);
    });
    return calls;
  }
  beforeEach(() => {
    process.env.BOT_TOKEN = 'test-token';
    process.env.ADMIN_ID = '777';
    setPostboxEnv();
  });
  afterEach(() => jest.useRealTimers());

  it('срок в бюджете — ждёт, повторяет и доставляет в Telegram, письма нет', async () => {
    jest.useFakeTimers();
    const calls = mockTelegram([{ ok: false, body: body429(5) }, { ok: true }]);
    const done = notifyAdminWithFallback('алерт');
    await jest.advanceTimersByTimeAsync(5000);
    await done;
    expect(calls).toEqual([TG, TG]);
  });

  it('срок дольше бюджета — не ждёт, сразу письмо', async () => {
    const calls = mockTelegram([{ ok: false, body: body429(120) }]);
    await notifyAdminWithFallback('алерт');
    expect(calls).toEqual([TG, POSTBOX]);
  });
});
