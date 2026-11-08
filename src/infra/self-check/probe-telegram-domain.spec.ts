// Проба входа через Telegram (инцидент 2026-08-21, шапка probe-telegram-domain.ts):
// оба состояния сторожка — домен привязан / отвязан — плюс сбои площадки.
import { readFileSync } from 'fs';
import { join } from 'path';
import { telegramOauthLoginUrl } from '../../auth/telegram-oauth-url';
import {
  DOMAIN_BROKEN_MARKERS,
  judgeTelegramDomain,
  telegramDomainProbe,
} from './probe-telegram-domain';

const env = {
  BOT_TOKEN: '123456:secret-part',
  WEBAPP_URL: 'https://schemehappens.ru/',
};
const reply = (status: number, body: string) =>
  jest.fn().mockResolvedValue({ status, text: async () => body });
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('telegramDomainProbe', () => {
  it('домен отвязан («Bot domain invalid») — красная, в detail домен и как чинить', async () => {
    global.fetch = reply(200, 'Bot domain invalid') as never;
    const res = await telegramDomainProbe(env).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('«Bot domain invalid»');
    expect(res.detail).toContain('https://schemehappens.ru');
    expect(res.detail).toContain('/setdomain');
  });

  it('домен привязан (страница входа) — зелёная', async () => {
    global.fetch = reply(200, '<html>Log in to Schema Happens</html>') as never;
    const res = await telegramDomainProbe(env).run();
    expect(res).toEqual({
      ok: true,
      detail:
        'oauth.telegram.org отдаёт страницу входа для https://schemehappens.ru',
    });
  });

  it('ходит на тот же URL, что открывает боевой редирект, с таймаутом; токен — только id бота', async () => {
    const fetchMock = reply(200, 'ok');
    global.fetch = fetchMock as never;
    await telegramDomainProbe(env).run();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      telegramOauthLoginUrl('123456', 'https://schemehappens.ru'),
    );
    expect(url).not.toContain('secret-part');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('HTTP-ошибка площадки — красная со статусом; сеть упала — красная, не бросает', async () => {
    global.fetch = reply(502, 'Bad gateway') as never;
    expect(await telegramDomainProbe(env).run()).toMatchObject({
      ok: false,
      detail: expect.stringContaining('HTTP 502'),
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as never;
    expect(await telegramDomainProbe(env).run()).toMatchObject({
      ok: false,
      detail: expect.stringContaining('не ответил: timeout'),
    });
  });

  it('нет BOT_TOKEN или WEBAPP_URL — «выключено», в сеть не ходит', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    expect(
      await telegramDomainProbe({ WEBAPP_URL: env.WEBAPP_URL }).run(),
    ).toEqual({ ok: true, detail: 'выключено' });
    expect(
      await telegramDomainProbe({ BOT_TOKEN: env.BOT_TOKEN }).run(),
    ).toEqual({ ok: true, detail: 'выключено' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('живой внешний запрос: повтор после вспышки связи, наружу в /health не идёт', () => {
    expect(telegramDomainProbe(env)).toMatchObject({
      id: 'telegramDomain',
      retryOnce: true,
      reportInHealth: false,
    });
  });
});

describe('judgeTelegramDomain', () => {
  it('маркер поломки важнее статуса: «Bot not found» с 400 — про бота, не «HTTP 400»', () => {
    const res = judgeTelegramDomain(400, 'Bot not found', 'https://x.ru');
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('«Bot not found»');
  });
});

// Правило №4: сторожок (DM по переходу) и проба обязаны считать поломкой одно
// и то же. Список сторожка не экспортируется (src/auth — чужая зона правки),
// поэтому сверка — по исходнику.
describe('маркеры поломки совпадают со сторожком', () => {
  it('DOMAIN_BROKEN_MARKERS = BROKEN_MARKERS в telegram-domain-watchdog.service.ts', () => {
    const src = readFileSync(
      join(__dirname, '../../auth/telegram-domain-watchdog.service.ts'),
      'utf8',
    );
    const m = /const BROKEN_MARKERS = \[([^\]]*)\]/.exec(src);
    expect(m).not.toBeNull();
    const watchdog = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(watchdog.length).toBeGreaterThan(0);
    expect([...DOMAIN_BROKEN_MARKERS].sort()).toEqual(watchdog.sort());
  });
});
