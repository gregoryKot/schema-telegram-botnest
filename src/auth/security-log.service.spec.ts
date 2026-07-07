import { Logger } from '@nestjs/common';
import { SecurityLogService } from './security-log.service';

const flush = () => new Promise((r) => setImmediate(r));

describe('SecurityLogService', () => {
  let logSpy: jest.SpyInstance;
  const ORIG = { ...process.env };

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined as any);
    process.env.BOT_TOKEN = 'tok';
    process.env.ADMIN_ID = '1';
    // e-mail фолбэк выключен по умолчанию, чтобы считать fetch-вызовы детерминированно
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (global.fetch as any) = undefined;
    process.env.BOT_TOKEN = ORIG.BOT_TOKEN;
    process.env.ADMIN_ID = ORIG.ADMIN_ID;
  });

  it('пишет каждое событие в server-лог с тегом события', () => {
    new SecurityLogService().log('login_success', { userId: 5n });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[login_success]'));
  });

  it('обычное событие (login_success) НЕ шлёт DM админу', async () => {
    new SecurityLogService().log('login_success', { userId: 5n });
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('alert-событие (suspicious_initdata) шлёт DM админу через Telegram API', async () => {
    new SecurityLogService().log('suspicious_initdata', { ip: '1.2.3.4' });
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/sendMessage');
  });

  it('редактирует секреты и приводит bigint к строке в логах', () => {
    new SecurityLogService().log('login_success', {
      accessToken: 'abc', password: 'p', secretKey: 's', initData: 'x', userId: 42n, ip: '1.1.1.1',
    });
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toContain('"accessToken":"[redacted]"');
    expect(line).toContain('"password":"[redacted]"');
    expect(line).toContain('"secretKey":"[redacted]"');
    expect(line).toContain('"initData":"[redacted]"');
    expect(line).toContain('"userId":"42"'); // bigint → строка (JSON.stringify не падает)
    expect(line).toContain('"ip":"1.1.1.1"'); // не-секрет проходит как есть
  });

  it('без BOT_TOKEN / ADMIN_ID (и без e-mail фолбэка) наружу ничего не шлётся', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    new SecurityLogService().log('role_changed', { userId: 1n });
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('Telegram упал → фолбэк на e-mail (Resend), log() не бросает', async () => {
    process.env.RESEND_API_KEY = 'rk';
    process.env.ADMIN_EMAIL = 'admin@x.ru';
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('telegram down'))       // sendMessage
      .mockResolvedValueOnce({ ok: true }) as any;             // resend
    expect(() => new SecurityLogService().log('csrf_blocked', { ip: '9.9.9.9' })).not.toThrow();
    await flush();
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls[0]).toContain('/sendMessage');
    expect(calls[1]).toContain('api.resend.com/emails');
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
  });

  it('оба канала упали → log() всё равно не бросает', async () => {
    process.env.RESEND_API_KEY = 'rk';
    process.env.ADMIN_EMAIL = 'admin@x.ru';
    global.fetch = jest.fn().mockRejectedValue(new Error('all down')) as any;
    expect(() => new SecurityLogService().log('csrf_blocked', { ip: '9.9.9.9' })).not.toThrow();
    await flush();
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
  });
});
