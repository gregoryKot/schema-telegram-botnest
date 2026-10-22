// DM о старте (аудит 2026-10, «Супервизор контейнера»): первый запуск в
// контейнере — «Деплой завершён», следующие — честно «перезапущено после
// падения», и только когда супервизор не заглушил (троттл живёт в
// deploy/crash-window.mjs: память процесса после падения чистая). То, что
// данные супервизора реально доходят до процесса приложения, держит шов в
// maintenance-startup.spec.ts.
import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  announceStart,
  shouldAnnounce,
  startAnnouncement,
} from './start-announce';
import { readStartupEnv, STARTUP_ENV } from './start-launch-env';
import { TelegramService } from './telegram.service';

describe('startAnnouncement', () => {
  it.each([undefined, '', '1', '0', '-3', 'abc', '2.5'])(
    'launch=%p → обычный DM о деплое',
    (launch) => {
      expect(startAnnouncement({ launch, crashes: '3' })).toBe(
        '🚀 Деплой завершён',
      );
    },
  );

  it('перезапуск с числом падений за сутки — и когда будет следующее', () => {
    const text = startAnnouncement({ launch: '7', crashes: '4' });
    expect(text).toBe(
      '⚠️ Приложение перезапущено после падения (запуск 7 с начала работы ' +
        'контейнера). Падений за сутки: 4. Следующее такое сообщение — когда ' +
        'их станет 8. Причина — в логах контейнера.',
    );
    expect(text).not.toMatch(/Деплой завершён/);
  });

  it.each([undefined, '0', 'abc'])(
    'перезапуск без числа падений (crashes=%p) — без строки про сутки',
    (crashes) => {
      expect(startAnnouncement({ launch: '2', crashes })).toBe(
        '⚠️ Приложение перезапущено после падения (запуск 2 с начала работы ' +
          'контейнера). Причина — в логах контейнера.',
      );
    },
  );
});

describe('shouldAnnounce', () => {
  it.each([
    [{ notice: '1' }, undefined, true],
    [{}, undefined, true], // без супервизора (локальный запуск) — как раньше
    [{ notice: '0' }, undefined, false], // троттл супервизора
    [{ notice: '1' }, 'new_bot', false], // режим переезда бота молчал и до починки
  ])('%p, redirect=%p → %p', (env, redirect, want) => {
    expect(shouldAnnounce(env, redirect)).toBe(want);
  });
});

describe('readStartupEnv', () => {
  const names = Object.values(STARTUP_ENV);
  const saved = names.map((n) => process.env[n]);
  afterEach(() => {
    names.forEach((n, i) => {
      if (saved[i] === undefined) delete process.env[n];
      else process.env[n] = saved[i];
    });
  });

  it('читает ровно те имена, что пишет супервизор', () => {
    process.env[STARTUP_ENV.launch] = '5';
    process.env[STARTUP_ENV.crashes] = '4';
    process.env[STARTUP_ENV.notice] = '0';
    expect(readStartupEnv()).toEqual({
      launch: '5',
      crashes: '4',
      notice: '0',
    });
    expect(STARTUP_ENV).toEqual({
      launch: 'STARTUP_LAUNCH',
      crashes: 'STARTUP_CRASHES_DAY',
      notice: 'STARTUP_NOTICE',
    });
  });
});

describe('announceStart', () => {
  const keys = [...Object.values(STARTUP_ENV), 'BOT_REDIRECT_USERNAME'];
  const saved = keys.map((n) => process.env[n]);
  afterEach(() => {
    keys.forEach((n, i) => {
      if (saved[i] === undefined) delete process.env[n];
      else process.env[n] = saved[i];
    });
    jest.restoreAllMocks();
  });
  beforeEach(() => keys.forEach((n) => delete process.env[n]));

  function appWith(notifyAdmin: jest.Mock): {
    app: INestApplicationContext;
    get: jest.Mock;
  } {
    const get = jest.fn(() => ({ notifyAdmin }));
    return { app: { get } as unknown as INestApplicationContext, get };
  }

  it('шлёт текст по данным супервизора через TelegramService.notifyAdmin', async () => {
    process.env[STARTUP_ENV.launch] = '3';
    process.env[STARTUP_ENV.crashes] = '2';
    process.env[STARTUP_ENV.notice] = '1';
    const notifyAdmin = jest.fn().mockResolvedValue(true);
    const { app, get } = appWith(notifyAdmin);
    await expect(announceStart(app)).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith(TelegramService);
    expect(notifyAdmin).toHaveBeenCalledWith(
      startAnnouncement({ launch: '3', crashes: '2' }),
    );
  });

  it('без данных супервизора — «Деплой завершён»', async () => {
    const notifyAdmin = jest.fn().mockResolvedValue(false);
    await expect(announceStart(appWith(notifyAdmin).app)).resolves.toBe(false);
    expect(notifyAdmin).toHaveBeenCalledWith('🚀 Деплой завершён');
  });

  it.each([
    ['STARTUP_NOTICE=0', STARTUP_ENV.notice, '0'],
    ['режим переезда бота', 'BOT_REDIRECT_USERNAME', 'new_bot'],
  ])('%s → DM не уходит, строка в лог', async (_name, key, value) => {
    process.env[key] = value;
    process.env[STARTUP_ENV.launch] = '3';
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const notifyAdmin = jest.fn();
    const { app, get } = appWith(notifyAdmin);
    await expect(announceStart(app)).resolves.toBe(false);
    expect(get).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^start DM skipped/),
    );
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

// Ревью: ничто не держало сам вызов. Убери строку из main.ts вместе с импортом
// — DM о старте и перезапуске пропал бы молча, а все тесты выше остались бы
// зелёными. Пин статический: исполнять bootstrap ради одного порядка дорого.
/** `announceStart(app)` стоит после `await app.listen(` и не закомментирован. */
function announcesAfterListen(src: string): boolean {
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const listen = code.indexOf('await app.listen(');
  const call = code.search(/\bannounceStart\(app\)/);
  return listen >= 0 && call > listen;
}

describe('main.ts зовёт announceStart после listen', () => {
  const MAIN = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8');

  it('настоящий main.ts', () => {
    expect(announcesAfterListen(MAIN)).toBe(true);
  });

  it.each([
    ['без вызова', MAIN.replace(/.*announceStart\(app\).*\n/, '')],
    ['вызов до listen', 'void announceStart(app);\nawait app.listen(port);\n'],
    [
      'вызов закомментирован',
      'await app.listen(port);\n// void announceStart(app);\n',
    ],
  ])('контроль: %s → красный', (_name, src) => {
    expect(announcesAfterListen(src)).toBe(false);
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
      service(botWith(sendMessage)).notifyAdmin(
        startAnnouncement({ launch: '1' }),
      ),
    ).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith('42', '🚀 Деплой завершён', {
      parse_mode: 'HTML',
    });
  });
});
