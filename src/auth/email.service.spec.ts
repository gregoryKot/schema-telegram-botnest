// Письмо со ссылкой входа несёт живой токен: в проде тело письма не должно
// попадать в лог. HTTP-путь Resend и обёртки над send() — в
// email.service.send.spec.ts.
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

// Аудит 2026-07: логи (и DM админа через AlertLogger) не должны содержать
// magic-link-токен (M9).
describe('EmailService — не логирует секреты (M9)', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  const origEnv = process.env.NODE_ENV;
  const origKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
    process.env.NODE_ENV = origEnv;
    if (origKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = origKey;
  });

  const allLogged = () =>
    [...warn.mock.calls, ...error.mock.calls].flat().join(' | ');

  // send() приватный — зовём напрямую, чтобы проверить ветку «нет ключа».
  const callSend = (service: EmailService) =>
    (service as any).send(
      'a@test.com',
      'Subject',
      'Открой https://schemehappens.ru/verify?token=SECRETTOKEN123',
    ) as Promise<void>;

  it('M9: в проде без RESEND_API_KEY тело письма/токен НЕ логируются', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
    const service = new EmailService();
    await callSend(service);
    const logged = allLogged();
    expect(logged).not.toContain('SECRETTOKEN123');
    expect(logged).not.toContain('token=');
    expect(logged).not.toContain('a@test.com');
    // Мисконфиг всё же громко замечен (→ DM админа через AlertLogger).
    expect(error).toHaveBeenCalled();
    expect(logged).toContain('RESEND_API_KEY not configured');
  });

  it('M9: в dev (не prod) тело по-прежнему логируется для локальной проверки', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.RESEND_API_KEY;
    const service = new EmailService();
    await callSend(service);
    expect(allLogged()).toContain('token=SECRETTOKEN123');
  });
});
