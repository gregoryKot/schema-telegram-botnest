// Покрывает публичные обёртки над приватным send() — sendLoginLink,
// sendAdminNotification — и сам HTTP-путь send() через Resend (успех/ошибка
// ответа/сетевая ошибка), до этого теста непокрытый совсем
// (email.service.spec.ts мокал send() на границе, сюда не заходил).
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

function makeConfig() {
  return { getOrThrow: () => 'https://schemehappens.ru' } as any;
}

function makePrisma() {
  return {} as any;
}

describe('EmailService.sendLoginLink', () => {
  it('отправляет письмо со ссылкой через send() (subject/text содержат ссылку)', async () => {
    const service = new EmailService(makePrisma(), makeConfig());
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

  it('ADMIN_EMAIL не настроен — молча ничего не отправляет', async () => {
    delete process.env.ADMIN_EMAIL;
    const service = new EmailService(makePrisma(), makeConfig());
    const spy = jest.spyOn(service as any, 'send').mockResolvedValue(undefined);

    const result = await service.sendAdminNotification('Тема', 'Текст');
    expect(result).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('ADMIN_EMAIL настроен — отправляет на этот адрес', async () => {
    process.env.ADMIN_EMAIL = 'admin@test.com';
    const service = new EmailService(makePrisma(), makeConfig());
    const spy = jest.spyOn(service as any, 'send').mockResolvedValue(undefined);

    await service.sendAdminNotification('Новая бронь', 'Детали брони');
    expect(spy).toHaveBeenCalledWith(
      'admin@test.com',
      'Новая бронь',
      'Детали брони',
    );
  });

  it('падение send() не пробрасывается наружу — логируется и проглатывается', async () => {
    process.env.ADMIN_EMAIL = 'admin@test.com';
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const service = new EmailService(makePrisma(), makeConfig());
    jest
      .spyOn(service as any, 'send')
      .mockRejectedValue(new Error('Email delivery failed'));

    await expect(
      service.sendAdminNotification('Тема', 'Текст'),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('sendAdminNotification failed'),
    );
    error.mockRestore();
  });
});

describe('EmailService.send — Resend HTTP wrapper', () => {
  const origKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.EMAIL_FROM;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'Schema Happens <no-reply@schemehappens.ru>';
    fetchSpy = jest.spyOn(global, 'fetch' as any);
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    if (origKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = origKey;
    if (origFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = origFrom;
  });

  it('успешный ответ Resend — запрос уходит с корректными полями, промис резолвится', async () => {
    fetchSpy.mockResolvedValue({ ok: true, text: async () => '' } as any);
    const service = new EmailService(makePrisma(), makeConfig());

    await expect(
      (service as any).send('a@test.com', 'Тема', 'Текст письма'),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body).toMatchObject({
      to: 'a@test.com',
      subject: 'Тема',
      text: 'Текст письма',
      from: 'Schema Happens <no-reply@schemehappens.ru>',
    });
  });

  it('Resend отвечает не-ok — send() бросает "Email delivery failed"', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'invalid recipient',
    } as any);
    const service = new EmailService(makePrisma(), makeConfig());

    await expect(
      (service as any).send('a@test.com', 'Тема', 'Текст'),
    ).rejects.toThrow('Email delivery failed');
  });

  it('сетевая ошибка fetch — send() бросает "Email delivery failed" с cause', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
    const service = new EmailService(makePrisma(), makeConfig());

    await expect(
      (service as any).send('a@test.com', 'Тема', 'Текст'),
    ).rejects.toThrow('Email delivery failed');
  });
});
