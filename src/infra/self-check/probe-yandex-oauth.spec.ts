// Проба «Вход через Яндекс»: судьи — на ЗАПИСАННЫХ ответах площадки
// (test/fixtures/recorded/yandex-id-oauth.json, правило №23), проба целиком —
// с подменённым fetch. Класс инцидента — 2026-10-03 (VK молча резал state):
// поломку на стороне площадки обязана найти проба, а не владелец.
import { loadRecordedFixture } from '../../test-support/recorded-fixture';
import {
  judgeYandexAuthorize,
  judgeYandexToken,
  yandexOAuthProbe,
} from './probe-yandex-oauth';
import { SAMPLE_STATE } from './probe-oauth-providers';

interface Answer {
  status: number;
  body: Record<string, unknown>;
}
const rec = JSON.parse(loadRecordedFixture('yandex-id-oauth.json')) as {
  authorizeAnonymous: {
    request: { query: Record<string, string> };
    response: { status: number; location: string };
  };
  token: { ok: Answer; wrongSecret: Answer; unknownClient: Answer };
};
const HOP = rec.authorizeAnonymous.response;
const SENT = rec.authorizeAnonymous.request.query.state;

const SECRET = 'probe-secret-must-not-leak';
const ENV = {
  YANDEX_CLIENT_ID: rec.authorizeAnonymous.request.query.client_id,
  YANDEX_CLIENT_SECRET: SECRET,
  YANDEX_REDIRECT_URI: rec.authorizeAnonymous.request.query.redirect_uri,
};

/** Площадка: authorize отвечает 302 с тем state, что прислали; token — как задано. */
function yandex(
  token: Answer | Error,
  mangleState: (state: string) => string = (s) => s,
): jest.Mock {
  const mock = jest.fn((url: string) => {
    if (url.startsWith('https://oauth.yandex.ru/authorize')) {
      const back = new URL(url);
      back.searchParams.set(
        'state',
        mangleState(back.searchParams.get('state') ?? ''),
      );
      const location = `https://passport.yandex.ru/auth?retpath=${encodeURIComponent(back.toString())}&noreturn=1&origin=oauth`;
      return Promise.resolve({ status: 302, headers: { get: () => location } });
    }
    if (token instanceof Error) return Promise.reject(token);
    return Promise.resolve({
      status: token.status,
      json: () => Promise.resolve(token.body),
    });
  });
  global.fetch = mock as never;
  return mock;
}
const codeRefused = (error: string): Answer => ({
  status: 400,
  body: { error, error_description: 'Code has expired' },
});

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('judgeYandexAuthorize (записанный первый ответ authorize)', () => {
  it('302 на passport.yandex.ru, state в retpath без изменений — зелёный', () => {
    expect(judgeYandexAuthorize(HOP, SENT).ok).toBe(true);
  });

  it('state с точками вернулся бы урезанным — красный (класс инцидента VK)', () => {
    const res = judgeYandexAuthorize(HOP, `${SENT}.tail`);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('state изменённым');
  });

  it.each([
    ['страница 200 вместо перехода', { status: 200, location: null }],
    ['переход не на вход Яндекса', { ...HOP, location: 'https://ya.ru/' }],
    ['ошибка площадки 503', { status: 503, location: null }],
    ['адрес перехода не разобрать', { status: 302, location: '::::' }],
  ])('%s — красный, с кодом ответа', (_name, hop) => {
    const res = judgeYandexAuthorize(hop, SENT);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(`HTTP ${hop.status}`);
  });

  it('чужой хост перехода назван в detail — без адреса целиком (в нём state)', () => {
    const res = judgeYandexAuthorize(
      { status: 302, location: `https://ya.ru/showcaptcha?state=${SENT}` },
      SENT,
    );
    expect(res.detail).toContain('HTTP 302 (переход на ya.ru)');
    expect(res.detail).not.toContain(SENT);
  });

  it('retpath без state — красный, а не исключение', () => {
    const res = judgeYandexAuthorize(
      { status: 302, location: 'https://passport.yandex.ru/auth?retpath=x' },
      SENT,
    );
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(`${SENT.length} → 0`);
  });
});

describe('judgeYandexToken (записанные ответы POST /token)', () => {
  it.each([
    ['неверный секрет', rec.token.wrongSecret],
    ['неизвестное приложение', rec.token.unknownClient],
  ])('%s — красный: Яндекс отклонил client_id или секрет', (_name, answer) => {
    const res = judgeYandexToken(answer.status, answer.body);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('Яндекс отклонил client_id или секрет');
    expect(res.detail).toContain('invalid_client');
    expect(res.detail).toContain('YANDEX_CLIENT_SECRET');
  });

  // Не записано (секрета у сессии записи не было) — ответ по документации.
  it.each(['invalid_grant', 'bad_verification_code'])(
    'код-пустышка отклонён как код (%s) — приложение и секрет приняты',
    (error) => {
      const res = judgeYandexToken(400, codeRefused(error).body);
      expect(res).toEqual({
        ok: true,
        detail: `приложение и секрет приняты (на код-пустышку — ${error})`,
      });
    },
  );

  it.each([
    [
      'неожиданный код ошибки',
      400,
      { error: 'invalid_request' },
      'invalid_request',
    ],
    ['успех на код-пустышку', 200, rec.token.ok.body, 'unknown'],
    [
      'чужой текст вместо кода',
      400,
      { error: 'см. https://evil.example' },
      'unknown',
    ],
    ['ошибка сервера без тела', 502, {}, 'unknown'],
    ['тело не объектом', 500, 'Bad Gateway', 'unknown'],
  ])(
    '%s — красный, в detail статус и только код',
    (_name, status, body, code) => {
      const res = judgeYandexToken(status, body);
      expect(res.ok).toBe(false);
      expect(res.detail).toContain(`HTTP ${status}`);
      expect(res.detail).toContain(`«${code}»`);
      expect(res.detail).not.toContain('evil.example');
      expect(res.detail).not.toContain('REDACTED');
    },
  );
});

describe('yandexOAuthProbe целиком', () => {
  it('паспорт пробы: в /health не идёт, повтор после вспышки связи', () => {
    const probe = yandexOAuthProbe(ENV);
    expect(probe.id).toBe('yandexOAuth');
    expect(probe.title).toBe('Вход через Яндекс');
    expect(probe.reportInHealth).toBe(false);
    expect(probe.retryOnce).toBe(true);
  });

  it.each([
    ['env нет вовсе', {}],
    ['нет секрета', { ...ENV, YANDEX_CLIENT_SECRET: ' ' }],
    ['нет адреса возврата', { ...ENV, YANDEX_REDIRECT_URI: undefined }],
  ])('%s — выключено, в сеть не ходит', async (_name, env) => {
    global.fetch = jest.fn() as never;
    expect(await yandexOAuthProbe(env).run()).toEqual({
      ok: true,
      detail: 'выключено',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('оба запроса в порядке — зелёный; ссылка и обмен — кодом провайдера', async () => {
    const fetchMock = yandex(codeRefused('invalid_grant'));

    const res = await yandexOAuthProbe(ENV).run();

    expect(res.ok).toBe(true);
    expect(res.detail).toContain('state без изменений');
    expect(res.detail).toContain('приложение и секрет приняты');
    expect(res.detail).not.toContain(SECRET);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const [authorizeUrl, authorizeInit] = calls.find(([url]) =>
      url.includes('/authorize'),
    )!;
    const sent = new URL(authorizeUrl).searchParams;
    expect(sent.get('state')).toBe(SAMPLE_STATE);
    expect(SAMPLE_STATE).toContain('.');
    expect(sent.get('scope')).toBe('login:email login:info');
    expect(sent.get('client_id')).toBe(ENV.YANDEX_CLIENT_ID);
    expect(authorizeInit.redirect).toBe('manual');

    const [tokenUrl, tokenInit] = calls.find(([url]) =>
      url.endsWith('/token'),
    )!;
    expect(tokenUrl).toBe('https://oauth.yandex.ru/token');
    const body = new URLSearchParams(tokenInit.body as string);
    expect(body.get('client_id')).toBe(ENV.YANDEX_CLIENT_ID);
    expect(body.get('client_secret')).toBe(SECRET);
    expect(body.get('code')).toMatch(/^[a-z0-9]{16}$/);
  });

  it('Яндекс вернул state искажённым — красный', async () => {
    yandex(codeRefused('invalid_grant'), (s) => s.replace(/\./g, ''));
    const res = await yandexOAuthProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('state изменённым');
  });

  it('секрет отклонён (записанный invalid_client) — красный, секрета в detail нет', async () => {
    yandex(rec.token.wrongSecret);
    const res = await yandexOAuthProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('Яндекс отклонил client_id или секрет');
    expect(res.detail).not.toContain(SECRET);
  });

  it('сеть падает — красный, а не исключение из пробы', async () => {
    yandex(new Error('fetch failed'));
    const res = await yandexOAuthProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('Яндекс ID не ответил: fetch failed');
    expect(res.detail).not.toContain(SECRET);
  });
});
