import { Logger } from '@nestjs/common';
import { SecurityLogService } from './security-log.service';

const flush = () => new Promise((r) => setImmediate(r));

describe('SecurityLogService', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined as any);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined as any);
    process.env.BOT_TOKEN = 'tok';
    process.env.ADMIN_ID = '1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (global.fetch as any) = undefined;
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

  it('без BOT_TOKEN / ADMIN_ID DM не отправляется', async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_ID;
    new SecurityLogService().log('role_changed', { userId: 1n });
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('падение отправки DM не роняет log() — пишет warn', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('telegram down')) as any;
    expect(() => new SecurityLogService().log('csrf_blocked', { ip: '9.9.9.9' })).not.toThrow();
    await flush();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Admin alert failed'));
  });
});
