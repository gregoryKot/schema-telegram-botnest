// telegram-domain-watchdog.service.ts — часовой сторожок за привязкой
// домена в BotFather. Регресс инцидента 2026-08-21: привязка слетела,
// вход через Telegram на сайте был сломан у всех пользователей, и никто
// в системе этого не видел — узнали от пользователя. Admin-delivery
// (notifyAdminWithFallback) мокается на границе модуля — здесь проверяем
// только машину состояний (здоров/поломка/переход/суточное напоминание),
// не сеть и не доставку DM (см. admin-alert.spec.ts).
import { Logger } from '@nestjs/common';
import { TelegramDomainWatchdogService } from './telegram-domain-watchdog.service';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import type { ConfigService } from '@nestjs/config';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const mockedNotify = notifyAdminWithFallback as jest.Mock;
const flush = () => new Promise((r) => setImmediate(r));

const WEBAPP_URL = 'https://schemehappens.ru';
const BOT_TOKEN = '12345:TEST_SECRET';
const HEALTHY_HTML = '<html><body>страница входа Telegram</body></html>';
const BROKEN_TEXT = 'Bot domain invalid';

function makeConfig(
  overrides: Partial<Record<'BOT_TOKEN' | 'WEBAPP_URL', string>> = {},
): ConfigService {
  const map: Record<string, string> = {
    BOT_TOKEN,
    WEBAPP_URL,
    ...overrides,
  };
  // Undefined-значения в overrides обязаны реально стирать ключ (кейс
  // «BOT_TOKEN не задан»), а не оставаться строкой 'undefined'.
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete map[k];
  }
  return { get: jest.fn((k: string) => map[k]) } as unknown as ConfigService;
}

function makeClock(startMs: number) {
  let current = startMs;
  return { now: () => current, advance: (ms: number) => (current += ms) };
}

function mockFetchOk(text: string, ok = true) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: () => Promise.resolve(text),
  });
}

const realFetch = global.fetch;

beforeEach(() => {
  mockedNotify.mockClear();
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('TelegramDomainWatchdogService.check — здоровый ответ', () => {
  it('нет DM, fetch зовётся с URL от telegramOauthLoginUrl (bot_id/origin)', async () => {
    mockFetchOk(HEALTHY_HTML);
    const service = new TelegramDomainWatchdogService(makeConfig());

    await service.check();

    expect(mockedNotify).not.toHaveBeenCalled();
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('bot_id=12345');
    expect(url).toContain(`origin=${encodeURIComponent(WEBAPP_URL)}`);
  });
});

describe('TelegramDomainWatchdogService.check — поломка', () => {
  it('тело "Bot domain invalid" → ровно один DM с текстом причины и /setdomain', async () => {
    mockFetchOk(BROKEN_TEXT);
    const service = new TelegramDomainWatchdogService(makeConfig());

    await service.check();

    expect(mockedNotify).toHaveBeenCalledTimes(1);
    const [text] = mockedNotify.mock.calls[0] as [string, string];
    expect(text).toContain('Bot domain invalid');
    expect(text).toContain('/setdomain');
  });

  it('держится: check через 1 час — DM не добавился; через 25 часов — второй DM', async () => {
    const clock = makeClock(1_000_000);
    mockFetchOk(BROKEN_TEXT);
    const service = new TelegramDomainWatchdogService(makeConfig(), clock.now);

    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(1);

    clock.advance(3600_000);
    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(1);

    clock.advance(25 * 3600_000);
    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    // Напоминание — то же содержимое, что и первый алерт: причина и починка.
    expect(mockedNotify).toHaveBeenLastCalledWith(
      expect.stringContaining('Bot domain invalid'),
      expect.stringContaining('сломан'),
    );
  });

  it('поломка → здоровый ответ → одиночный DM «снова работает»; следующий здоровый check — без DM', async () => {
    const clock = makeClock(1_000_000);
    mockFetchOk(BROKEN_TEXT);
    const service = new TelegramDomainWatchdogService(makeConfig(), clock.now);
    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(1);

    mockFetchOk(HEALTHY_HTML);
    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    const [text, subject] = mockedNotify.mock.calls[1] as [string, string];
    expect(text).toContain('снова работает');
    expect(subject).toContain('починился');

    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
  });

  it('fetch кинул исключение → DM нет и состояние не сбрасывается: поломка → исключение → здоровье даёт recovery-DM', async () => {
    const service = new TelegramDomainWatchdogService(makeConfig());
    mockFetchOk(BROKEN_TEXT);
    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(1);

    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(1);

    mockFetchOk(HEALTHY_HTML);
    await service.check();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    const [text] = mockedNotify.mock.calls[1] as [string, string];
    expect(text).toContain('снова работает');
  });
});

describe('TelegramDomainWatchdogService.check — неизвестность (не поломка)', () => {
  it('res.ok=false (500) → DM нет, но warn в лог виден (немой сбой запрещён)', async () => {
    mockFetchOk('internal error', false);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new TelegramDomainWatchdogService(makeConfig());

    await service.check();

    expect(mockedNotify).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
  });
});

describe('TelegramDomainWatchdogService.check — конфиг не задан', () => {
  it('BOT_TOKEN не задан → fetch не звался вовсе', async () => {
    const config = makeConfig({ BOT_TOKEN: undefined });
    const service = new TelegramDomainWatchdogService(config);

    await service.check();

    // Выход именно по отсутствию токена: ключ прочитан — и на этом всё.
    expect(config.get).toHaveBeenCalledWith('BOT_TOKEN');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});

// Ждём микротаск-очередь на случай, если await service.check() где-то
// оставит незавершённый .catch() — держит спеки от "открытых хендлов".
afterAll(async () => {
  await flush();
});
