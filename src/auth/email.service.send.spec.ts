// Покрывает публичные обёртки над приватным send() — sendLoginLink,
// sendAdminNotification — и сам HTTP-путь send() через Postbox (успех/ошибка
// ответа/сетевая ошибка), до этого теста непокрытый совсем
// (email.service.spec.ts мокал send() на границе, сюда не заходил). Отказ
// площадки — записанный (test/fixtures/recorded/postbox-send-email-denied.json).
import { Logger } from '@nestjs/common';
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import { EmailService } from './email.service';

// Заглушки, не ключи: настоящих значений в репозитории нет.
const POSTBOX_ENV = {
  POSTBOX_ACCESS_KEY_ID: 'TEST_KEY_ID',
  POSTBOX_SECRET_ACCESS_KEY: 'test-secret-not-a-real-key',
};
const KEY_NAMES = Object.keys(POSTBOX_ENV) as Array<keyof typeof POSTBOX_ENV>;
const originalKeys = KEY_NAMES.map(
  (name) => [name, process.env[name]] as const,
);
function restorePostboxEnv() {
  for (const [name, value] of originalKeys) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
function clearPostboxEnv() {
  for (const name of KEY_NAMES) delete process.env[name];
}

describe('EmailService.sendLoginLink', () => {
  it('отправляет письмо со ссылкой через send() (subject/text содержат ссылку)', async () => {
    const service = new EmailService();
    const spy = jest.spyOn(service as any, 'send').mockResolvedValue(undefined);

    await service.sendLoginLink(
      'a@test.com',
      'https://schemehappens.ru/x?token=abc',
    );

    expect(spy).toHaveBeenCalledWith(
      'a@test.com',
      expect.stringContaining('Войти'),
      expect.stringContaining('https://schemehappens.ru/x?token=abc'),
    );
  });
});

describe('EmailService.sendAdminNotification', () => {
  const origAdmin = process.env.ADMIN_EMAIL;
  afterEach(() => {
    if (origAdmin === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = origAdmin;
  });

  it('ADMIN_EMAIL не настроен — письмо не уходит, но авария видна в логе (правило №14)', async () => {
    delete process.env.ADMIN_EMAIL;
    const service = new EmailService();
    const spy = jest.spyOn(service as any, 'send').mockResolvedValue(undefined);
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});

    const result = await service.sendAdminNotification(
      'Бронь ждёт оплаты',
      'Текст',
    );
    expect(result).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Бронь ждёт оплаты'),
    );
    warn.mockRestore();
  });

  it('ADMIN_EMAIL настроен — отправляет на этот адрес', async () => {
    process.env.ADMIN_EMAIL = 'admin@test.com';
    const service = new EmailService();
    const spy = jest.spyOn(service as any, 'send').mockResolvedValue(true);

    await expect(
      service.sendAdminNotification('Новая бронь', 'Детали брони'),
    ).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith(
      'admin@test.com',
      'Новая бронь',
      'Детали брони',
    );
  });

  it('падение send() не пробрасывается наружу — логируется, результат false', async () => {
    process.env.ADMIN_EMAIL = 'admin@test.com';
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const service = new EmailService();
    jest
      .spyOn(service as any, 'send')
      .mockRejectedValue(new Error('Email delivery failed'));

    await expect(service.sendAdminNotification('Тема', 'Текст')).resolves.toBe(
      false,
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('sendAdminNotification failed'),
    );
    error.mockRestore();
  });
});

describe('EmailService.send — запрос в Postbox', () => {
  const origFrom = process.env.EMAIL_FROM;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let error: jest.SpyInstance;

  beforeEach(() => {
    Object.assign(process.env, POSTBOX_ENV);
    process.env.EMAIL_FROM = 'Schema Happens <no-reply@schemehappens.ru>';
    fetchSpy = jest.spyOn(global, 'fetch');
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    // Снимок почты (alert-email-health.ts) пишет отказ уровнем warn.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    restorePostboxEnv();
    if (origFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = origFrom;
  });

  it('Postbox принял письмо — подписанный запрос с отправителем, получателем, темой и текстом', async () => {
    fetchSpy.mockResolvedValue(
      new Response('{"MessageId":"test-message-id"}', { status: 200 }),
    );
    const service = new EmailService();

    await expect(
      service.send('a@test.com', 'Тема', 'Текст письма'),
    ).resolves.toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://postbox.cloud.yandex.net/v2/email/outbound-emails',
    );
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=TEST_KEY_ID\/\d{8}\/ru-central1\/ses\/aws4_request, /,
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      FromEmailAddress: 'Schema Happens <no-reply@schemehappens.ru>',
      Destination: { ToAddresses: ['a@test.com'] },
      Content: {
        Simple: {
          Subject: { Data: 'Тема', Charset: 'UTF-8' },
          Body: { Text: { Data: 'Текст письма', Charset: 'UTF-8' } },
        },
      },
    });
  });

  it('записанный отказ Postbox (403 Forbidden) — send() бросает "Email delivery failed", в логе статус и причина', async () => {
    const denied = (
      JSON.parse(loadRecordedFixture('postbox-send-email-denied.json')) as {
        responses: Record<string, { status: number; body: string }>;
      }
    ).responses.badSignature;
    fetchSpy.mockResolvedValue(
      new Response(denied.body, { status: denied.status }),
    );
    const service = new EmailService();

    await expect(service.send('a@test.com', 'Тема', 'Текст')).rejects.toThrow(
      'Email delivery failed',
    );
    expect(error).toHaveBeenCalledWith('Postbox send failed 403: Forbidden');
  });

  it('отказ с адресом в теле ответа — адрес и ключ в лог не попадают', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        '{"Code":"MessageRejected","message":"a@test.com is not verified"}',
        { status: 400 },
      ),
    );

    await expect(
      new EmailService().send('a@test.com', 'Тема', 'Текст'),
    ).rejects.toThrow('Email delivery failed');
    const logged = error.mock.calls.flat().join(' | ');
    expect(logged).toContain('Postbox send failed 400: MessageRejected');
    expect(logged).not.toContain('a@test.com');
    expect(logged).not.toContain(POSTBOX_ENV.POSTBOX_SECRET_ACCESS_KEY);
  });

  it('сетевая ошибка fetch — send() бросает "Email delivery failed" с cause', async () => {
    const cause = new Error('ECONNRESET');
    fetchSpy.mockRejectedValue(cause);
    const service = new EmailService();

    await expect(
      service.send('a@test.com', 'Тема', 'Текст'),
    ).rejects.toMatchObject({ message: 'Email delivery failed', cause });
  });
});

// Для заявки с формы знакомства важно отличить «письмо ушло» от «send() молча
// вышел»: без ключей Postbox вернуть успех нельзя, иначе повтор доставки решит,
// что заявка дошла (intro-lead.service.ts).
describe('EmailService.send — без ключей Postbox письмо не считается отправленным', () => {
  const origEnv = process.env.NODE_ENV;
  afterEach(() => {
    restorePostboxEnv();
    process.env.NODE_ENV = origEnv;
    jest.restoreAllMocks();
  });

  it.each(['production', 'development'])(
    'NODE_ENV=%s: send() возвращает false, fetch не вызывается',
    async (env) => {
      clearPostboxEnv();
      process.env.NODE_ENV = env;
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const fetchSpy = jest.spyOn(global, 'fetch');
      const service = new EmailService();

      await expect(service.send('a@test.com', 'Тема', 'Текст')).resolves.toBe(
        false,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  // Подпись собирается из пары: один ключ без другого — та же «не настроено».
  it.each(KEY_NAMES)(
    'задан только один ключ (нет %s) — false, fetch не вызывается',
    async (missing) => {
      Object.assign(process.env, POSTBOX_ENV);
      delete process.env[missing];
      process.env.NODE_ENV = 'production';
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      const fetchSpy = jest.spyOn(global, 'fetch');

      await expect(
        new EmailService().send('a@test.com', 'Тема', 'Текст'),
      ).resolves.toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('sendAdminNotification без ключей в проде — false (не засчитывается как доставка)', async () => {
    clearPostboxEnv();
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAIL = 'admin@test.com';
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const service = new EmailService();

    await expect(service.sendAdminNotification('Тема', 'Текст')).resolves.toBe(
      false,
    );
    delete process.env.ADMIN_EMAIL;
  });
});
