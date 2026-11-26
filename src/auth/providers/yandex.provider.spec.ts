// YandexProvider — вход через Яндекс ID. Ответы площадки здесь ЗАПИСАННЫЕ
// (test/fixtures/recorded/yandex-id-oauth.json, 2026-11-12), а не форма «по
// документации» (правило №23): запись показала 16-символьный code, параметр
// cid и state, возвращённый с точками JWT. Регрессия здесь либо пускает токен,
// выданный чужому приложению, либо ломает вход всем, кто входит через Яндекс.
// fetch подменяется по образцу vk.provider.spec.ts.
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { loadRecordedFixture } from '../../test-support/recorded-fixture';
import {
  YANDEX_SCOPE,
  YandexProvider,
  parseYandexProfile,
  parseYandexToken,
} from './yandex.provider';

interface Answer {
  status: number;
  body: Record<string, unknown>;
}
const rec = JSON.parse(loadRecordedFixture('yandex-id-oauth.json')) as {
  authorizeAnonymous: {
    request: { url: string; query: Record<string, string> };
  };
  callback: { stateSent: string; query: Record<string, string> };
  token: { ok: Answer; wrongSecret: Answer; unknownClient: Answer };
  info: { ok: Answer; noToken: Answer; badToken: Answer };
};

const CLIENT_ID = rec.authorizeAnonymous.request.query.client_id;
const SECRET = 'client-secret-0123456789';
const CONFIG_MAP: Record<string, string> = {
  YANDEX_CLIENT_ID: CLIENT_ID,
  YANDEX_CLIENT_SECRET: SECRET,
  YANDEX_REDIRECT_URI: rec.authorizeAnonymous.request.query.redirect_uri,
};

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const map = { ...CONFIG_MAP, ...overrides };
  return {
    getOrThrow: (key: string) => {
      if (!(key in map)) throw new Error(`missing config key: ${key}`);
      return map[key];
    },
  } as unknown as ConfigService;
}

/** Ответ fetch той же формы, что записанный: статус и тело. */
const reply = ({ status, body }: Answer) => ({
  status,
  json: () => Promise.resolve(body),
});
/** Настоящий токен — не «REDACTED» из фикстуры: его ищем в текстах ошибок. */
const TOKEN = 'y0_token-must-not-leak';
const tokenOk = reply({
  ...rec.token.ok,
  body: { ...rec.token.ok.body, access_token: TOKEN },
});
const profile = (patch: Record<string, unknown>): Answer => ({
  ...rec.info.ok,
  body: { ...rec.info.ok.body, ...patch },
});

type FetchCall = [string, RequestInit & { headers?: Record<string, string> }];
function mockFetch(...answers: unknown[]): jest.Mock {
  const mock = jest.fn();
  for (const a of answers) mock.mockResolvedValueOnce(a);
  global.fetch = mock as never;
  return mock;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('parseYandexToken (записанные ответы POST /token)', () => {
  it('успех — отдаёт access_token', () => {
    expect(parseYandexToken(rec.token.ok.status, rec.token.ok.body)).toBe(
      rec.token.ok.body.access_token,
    );
  });

  it.each([
    ['неверный секрет', rec.token.wrongSecret],
    ['неизвестное приложение', rec.token.unknownClient],
  ])('%s — отказ с кодом площадки, без её описания', (_name, answer) => {
    const call = () => parseYandexToken(answer.status, answer.body);
    expect(call).toThrow(UnauthorizedException);
    expect(call).toThrow('Yandex token error: invalid_client (HTTP 400)');
    expect(call).not.toThrow(String(answer.body.error_description));
  });

  it('200 без access_token и тело не объектом — отказ, а не пустой токен', () => {
    expect(() => parseYandexToken(200, { token_type: 'bearer' })).toThrow(
      'Yandex token error: unknown (HTTP 200)',
    );
    expect(() => parseYandexToken(200, 'ok')).toThrow(UnauthorizedException);
    expect(() => parseYandexToken(200, null)).toThrow(UnauthorizedException);
  });

  it('код ошибки не по форме (чужой текст) сводится к unknown', () => {
    expect(() =>
      parseYandexToken(400, { error: 'Зайди на https://evil.example' }),
    ).toThrow('Yandex token error: unknown (HTTP 400)');
  });
});

describe('parseYandexProfile (записанные ответы GET /info)', () => {
  const { status, body } = rec.info.ok;

  it('берёт только id, default_email и first_name', () => {
    expect(parseYandexProfile(status, body, CLIENT_ID)).toEqual({
      providerId: body.id,
      email: body.default_email,
      displayName: body.first_name,
    });
    // Контроль фикстуры: в ответе есть и то, что мы не читаем.
    expect(body).toEqual(
      expect.objectContaining({
        login: expect.any(String),
        last_name: expect.any(String),
        sex: expect.any(String),
        psuid: expect.any(String),
        emails: expect.any(Array),
      }),
    );
  });

  it.each([
    ['без токена', rec.info.noToken],
    ['токен не принят', rec.info.badToken],
  ])('%s — отказ с кодом, без текста площадки', (_name, answer) => {
    const call = () =>
      parseYandexProfile(answer.status, answer.body, CLIENT_ID);
    expect(call).toThrow('Yandex profile error: not_authorized (HTTP 401)');
    expect(call).not.toThrow(String(answer.body.message));
  });

  it('client_id ответа не наш — токен выдан чужому приложению, вход отклонён', () => {
    expect(() => parseYandexProfile(status, body, 'f'.repeat(32))).toThrow(
      'Yandex profile error: client_id_mismatch (HTTP 200)',
    );
    const { client_id: _omit, ...withoutClient } = body;
    expect(() => parseYandexProfile(status, withoutClient, CLIENT_ID)).toThrow(
      'client_id_mismatch',
    );
  });

  it.each([
    ['пустой', ''],
    ['не из цифр', '12ab'],
    ['с пробелом', '123 456'],
    ['число, а не строка', 1234567890],
    ['отсутствует', undefined],
  ])('id %s — отказ, аккаунт не заводится', (_name, id) => {
    expect(() =>
      parseYandexProfile(status, { ...body, id }, CLIENT_ID),
    ).toThrow('Yandex profile error: bad_id (HTTP 200)');
  });

  it('почта — в нижнем регистре и без пробелов; не почта и не строка — не берётся', () => {
    const email = (value: unknown) =>
      parseYandexProfile(status, { ...body, default_email: value }, CLIENT_ID)
        .email;
    expect(email('  User@Example.COM ')).toBe('user@example.com');
    expect(email('не почта')).toBeUndefined();
    expect(email('')).toBeUndefined();
    expect(email(['a@b.ru'])).toBeUndefined();
  });

  it('имя — только first_name: без него имени нет, фамилия и логин не подставляются', () => {
    const { first_name: _omit, ...noName } = body;
    expect(
      parseYandexProfile(status, noName, CLIENT_ID).displayName,
    ).toBeUndefined();
    const named = parseYandexProfile(
      status,
      { ...body, first_name: `  ${'я'.repeat(100)} ` },
      CLIENT_ID,
    );
    expect(named.displayName).toBe('я'.repeat(64));
  });
});

describe('YandexProvider.buildAuthUrl', () => {
  const provider = new YandexProvider(makeConfig());
  const { request } = rec.authorizeAnonymous;

  it('строит тот же запрос, что записан с площадки', () => {
    const url = new URL(provider.buildAuthUrl(request.query.state));
    expect(url.origin + url.pathname).toBe(request.url);
    expect(Object.fromEntries(url.searchParams)).toEqual(request.query);
  });

  it('scope — ровно почта и имя, пробел уходит как %20', () => {
    const raw = provider.buildAuthUrl('s');
    expect(new URL(raw).searchParams.get('scope')).toBe(
      'login:email login:info',
    );
    expect(YANDEX_SCOPE).toBe('login:email login:info');
    expect(raw).toContain('scope=login%3Aemail%20login%3Ainfo');
    expect(raw).not.toContain('+');
  });

  it('state уходит байт в байт — точки JWT на месте (в отличие от VK)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJsaW5rIjpudWxsfQ.sig-_A1';
    const raw = provider.buildAuthUrl(jwt);
    expect(raw).toContain(`state=${jwt}`);
    expect(new URL(raw).searchParams.get('state')).toBe(jwt);
  });

  it('вход — без force_confirm; привязка — force_confirm=yes (выбор аккаунта)', () => {
    const login = new URL(provider.buildAuthUrl('s')).searchParams;
    expect(login.has('force_confirm')).toBe(false);
    const link = new URL(provider.buildAuthUrl('s', undefined, true))
      .searchParams;
    expect(link.get('force_confirm')).toBe('yes');
  });

  it('callbackOrigin() = origin YANDEX_REDIRECT_URI (кука oauth_state живёт на нём)', () => {
    expect(provider.callbackOrigin()).toBe('https://schemehappens.ru');
  });

  it('без env — бросает, а не строит ссылку с undefined', () => {
    const bare = new YandexProvider({
      getOrThrow: (k: string) => {
        throw new Error(`no ${k}`);
      },
    } as unknown as ConfigService);
    expect(() => bare.buildAuthUrl('s')).toThrow('no YANDEX_CLIENT_ID');
  });
});

describe('YandexProvider.exchangeCode', () => {
  const provider = new YandexProvider(makeConfig());
  const code = rec.callback.query.code;

  it('успех: обмен формой с секретом, профиль — с заголовком Authorization: OAuth', async () => {
    const fetchMock = mockFetch(tokenOk, reply(rec.info.ok));

    await expect(provider.exchangeCode(code)).resolves.toEqual({
      providerId: rec.info.ok.body.id,
      email: rec.info.ok.body.default_email,
      displayName: rec.info.ok.body.first_name,
    });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as FetchCall;
    expect(tokenUrl).toBe('https://oauth.yandex.ru/token');
    expect(tokenInit.method).toBe('POST');
    expect(tokenInit.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(
      Object.fromEntries(new URLSearchParams(tokenInit.body as string)),
    ).toEqual({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: SECRET,
    });
    expect(tokenInit.signal).toBeInstanceOf(AbortSignal);

    const [infoUrl, infoInit] = fetchMock.mock.calls[1] as FetchCall;
    expect(infoUrl).toBe('https://login.yandex.ru/info?format=json');
    expect(infoInit.headers).toEqual({ Authorization: `OAuth ${TOKEN}` });
    expect(infoUrl).not.toContain(TOKEN);
    expect(infoInit.method).toBeUndefined();
    expect(infoInit.signal).toBeInstanceOf(AbortSignal);
  });

  it('ошибка обмена — отказ с кодом, за профилем не ходит', async () => {
    const fetchMock = mockFetch(reply(rec.token.wrongSecret));
    await expect(provider.exchangeCode(code)).rejects.toThrow(
      'Yandex token error: invalid_client (HTTP 400)',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['профиль не отдан', reply(rec.info.badToken), 'not_authorized (HTTP 401)'],
    [
      'чужой client_id',
      reply(profile({ client_id: 'f'.repeat(32) })),
      'client_id_mismatch',
    ],
    ['пустой id', reply(profile({ id: '' })), 'bad_id'],
    ['нецифровой id', reply(profile({ id: 'user' })), 'bad_id'],
    [
      'страница ошибки вместо JSON',
      {
        status: 502,
        json: () => Promise.reject(new SyntaxError(`<html>${TOKEN}`)),
      },
      'unknown (HTTP 502)',
    ],
  ])(
    '%s — отказ, токен и секрет в текст ошибки не попадают',
    async (_name, infoAnswer, expected) => {
      mockFetch(tokenOk, infoAnswer);
      const err = await provider.exchangeCode(code).catch((e: Error) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      const message = (err as Error).message;
      expect(message).toContain(`Yandex profile error: ${expected}`);
      expect(message).not.toContain(TOKEN);
      expect(message).not.toContain(SECRET);
    },
  );

  it('таймаут обмена — исключение без токена и секрета, профиль не запрашивается', async () => {
    const timeout = Object.assign(
      new Error('The operation was aborted due to timeout'),
      { name: 'TimeoutError' },
    );
    const fetchMock = jest.fn().mockRejectedValue(timeout);
    global.fetch = fetchMock as never;
    const err = await provider.exchangeCode(code).catch((e: Error) => e);
    expect((err as Error).name).toBe('TimeoutError');
    expect((err as Error).message).not.toContain(SECRET);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('таймаут профиля — исключение, личность не выдаётся', async () => {
    const timeout = Object.assign(new Error('aborted'), {
      name: 'TimeoutError',
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(tokenOk)
      .mockRejectedValueOnce(timeout);
    global.fetch = fetchMock as never;
    await expect(provider.exchangeCode(code)).rejects.toBe(timeout);
  });

  it('requestToken отдаёт статус и тело как есть (их судит проба самопроверки)', async () => {
    mockFetch(reply(rec.token.unknownClient));
    await expect(provider.requestToken('selfcheck', 1_000)).resolves.toEqual({
      status: 400,
      body: rec.token.unknownClient.body,
    });
  });
});
