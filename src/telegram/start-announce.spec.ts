// DM о старте (аудит 2026-10, «Супервизор контейнера»): первый запуск в
// контейнере — «Деплой завершён», следующие — честно «перезапущено после
// падения». Номер запуска ставит deploy/entrypoint.mjs; то, что он реально
// доходит до процесса приложения, держит шов в maintenance-startup.spec.ts.
import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import {
  announceStart,
  startAnnouncement,
  STARTUP_LAUNCH_ENV,
} from './start-announce';
import { TelegramService } from './telegram.service';

describe('startAnnouncement', () => {
  it.each([undefined, '', '1', '0', '-3', 'abc', '2.5'])(
    'launch=%p → обычный DM о деплое',
    (launch) => {
      expect(startAnnouncement(launch)).toBe('🚀 Деплой завершён');
    },
  );

  it.each([
    ['2', 2],
    ['7', 7],
  ])('launch=%p → DM о перезапуске с номером %d', (launch, n) => {
    const text = startAnnouncement(launch);
    expect(text).toBe(
      `⚠️ Приложение перезапущено после падения: запуск ${n} с начала ` +
        'работы контейнера. Причина — в логах контейнера.',
    );
    expect(text).not.toMatch(/Деплой завершён/);
  });
});

describe('announceStart', () => {
  const saved = process.env[STARTUP_LAUNCH_ENV];
  afterEach(() => {
    if (saved === undefined) delete process.env[STARTUP_LAUNCH_ENV];
    else process.env[STARTUP_LAUNCH_ENV] = saved;
    jest.restoreAllMocks();
  });

  function appWith(notifyAdmin: jest.Mock): {
    app: INestApplicationContext;
    get: jest.Mock;
  } {
    const get = jest.fn(() => ({ notifyAdmin }));
    return { app: { get } as unknown as INestApplicationContext, get };
  }

  it('шлёт текст по STARTUP_LAUNCH через TelegramService.notifyAdmin', async () => {
    process.env[STARTUP_LAUNCH_ENV] = '3';
    const notifyAdmin = jest.fn().mockResolvedValue(true);
    const { app, get } = appWith(notifyAdmin);
    await expect(announceStart(app)).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith(TelegramService);
    expect(notifyAdmin).toHaveBeenCalledWith(startAnnouncement('3'));
  });

  it('без номера запуска — «Деплой завершён»', async () => {
    delete process.env[STARTUP_LAUNCH_ENV];
    const notifyAdmin = jest.fn().mockResolvedValue(false);
    await expect(announceStart(appWith(notifyAdmin).app)).resolves.toBe(false);
    expect(notifyAdmin).toHaveBeenCalledWith('🚀 Деплой завершён');
  });

  it('сбой получения сервиса не бросает: false и строка в лог', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const app = {
      get: () => {
        throw new Error('no provider');
      },
    } as unknown as INestApplicationContext;
    await expect(announceStart(app)).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith('start DM failed', expect.any(Error));
  });
});

describe('TelegramService.notifyAdmin — канал DM о старте', () => {
  const saved = process.env.ADMIN_ID;
  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = saved;
  });

  function service(bot: object | null): TelegramService {
    const svc = Object.create(TelegramService.prototype) as TelegramService;
    Object.assign(svc, { bot, logger: { error: jest.fn() } });
    return svc;
  }
  const botWith = (sendMessage: jest.Mock) => ({ telegram: { sendMessage } });

  it('без ADMIN_ID DM не уходит', async () => {
    delete process.env.ADMIN_ID;
    const sendMessage = jest.fn();
    await expect(service(botWith(sendMessage)).notifyAdmin('x')).resolves.toBe(
      false,
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('без бота DM не уходит', async () => {
    process.env.ADMIN_ID = '42';
    await expect(service(null).notifyAdmin('x')).resolves.toBe(false);
  });

  it('с ботом и ADMIN_ID уходит владельцу', async () => {
    process.env.ADMIN_ID = '42';
    const sendMessage = jest.fn().mockResolvedValue({});
    await expect(
      service(botWith(sendMessage)).notifyAdmin(startAnnouncement('1')),
    ).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith('42', '🚀 Деплой завершён', {
      parse_mode: 'HTML',
    });
  });
});
