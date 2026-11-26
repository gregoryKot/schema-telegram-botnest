// Шов «колбэк площадки → вход/привязка → строка AuthProvider» на настоящих
// OAuthCallbackService, AuthFlowService, AuthService и YandexProvider; подделаны
// только сеть (ответы Яндекса — записанные, yandex-id-oauth.json) и таблицы
// (in-memory, fake-prisma.spec-helper). Проверяется read-after-write: что
// колбэк записал, то следующий вход и находит.
//
// Здесь же зафиксировано решение владельца 2026-11-12: СКЛЕЙКИ ПО ПОЧТЕ НЕТ —
// ни у Яндекса, ни у VK. Аккаунт ищется только по паре (provider, providerId);
// совпавший адрес почты — не доказательство, что это тот же человек (адрес у
// площадки мог быть не подтверждён или перейти к другому владельцу). Свой
// прежний аккаунт человек добавляет штатной привязкой из «Аккаунта».
// crypto.ts читает ключ на загрузке — модули грузим после установки env.
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import type { Row } from '../test-support/fake-prisma.spec-helper';

type Mods = {
  auth: typeof import('./auth.service');
  flow: typeof import('./auth-flow.service');
  callback: typeof import('./oauth-callback.service');
  yandex: typeof import('./providers/yandex.provider');
  helper: typeof import('../test-support/fake-prisma.spec-helper');
};
let m: Mods;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  m = {
    auth: require('./auth.service'),
    flow: require('./auth-flow.service'),
    callback: require('./oauth-callback.service'),
    yandex: require('./providers/yandex.provider'),
    helper: require('../test-support/fake-prisma.spec-helper'),
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
});

const rec = JSON.parse(loadRecordedFixture('yandex-id-oauth.json')) as {
  token: { ok: { status: number; body: Record<string, unknown> } };
  info: { ok: { status: number; body: Record<string, string> } };
};
const PROFILE = rec.info.ok.body;
const BASE = 'https://schemehappens.ru';
const ENV: Record<string, string> = {
  WEBAPP_URL: BASE,
  JWT_SECRET: 'seam-jwt-secret-0123456789abcdefghij',
  YANDEX_CLIENT_ID: PROFILE.client_id,
  YANDEX_CLIENT_SECRET: 'seam-secret',
  YANDEX_REDIRECT_URI: `${BASE}/api/auth/yandex/callback`,
};

/** Ответы площадки на один вход: токен, затем профиль (id можно подменить). */
function yandexAnswers(profilePatch: Record<string, unknown> = {}): void {
  const answer = (status: number, body: unknown) => ({
    status,
    json: () => Promise.resolve(body),
  });
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(answer(rec.token.ok.status, rec.token.ok.body))
    .mockResolvedValueOnce(
      answer(rec.info.ok.status, { ...PROFILE, ...profilePatch }),
    ) as never;
}

function build() {
  const providers: Row[] = [];
  const users: Row[] = [];
  const prisma = {
    authProvider: m.helper.createFakeTable(providers),
    user: m.helper.createFakeTable(users),
  };
  const config = {
    get: (k: string) => ENV[k],
    getOrThrow: (k: string) => {
      if (!ENV[k]) throw new Error(`no ${k}`);
      return ENV[k];
    },
  } as unknown as ConfigService;
  const auth = new m.auth.AuthService(
    prisma as never,
    config,
    { log: jest.fn() } as never,
    {} as never,
  );
  // Сессии здесь не предмет теста: кому выдан токен — и есть «кто вошёл».
  const issued: bigint[] = [];
  jest.spyOn(auth, 'issueTokens').mockImplementation((userId: bigint) => {
    issued.push(userId);
    return Promise.resolve({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
    });
  });
  const yandex = new m.yandex.YandexProvider(config);
  const registry = { get: () => yandex } as never;
  const notice = { linked: jest.fn() };
  const flow = new m.flow.AuthFlowService(
    auth,
    config,
    registry,
    { summarize: jest.fn() } as never,
    { isEnabled: jest.fn().mockResolvedValue(false) } as never,
    notice as never,
  );
  const track = jest.fn().mockResolvedValue(undefined);
  const callback = new m.callback.OAuthCallbackService(
    config,
    registry,
    flow,
    { track } as never,
    prisma as never,
  );
  /** Колбэк Яндекса с настоящим подписанным state (и той же кукой). */
  const comeBack = async (linkUserId: bigint | null) => {
    const state = flow.buildLinkState(linkUserId);
    const res = {
      redirect: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    await callback.complete(
      'yandex',
      {
        headers: { host: 'schemehappens.ru' },
        cookies: { oauth_state: state },
        ip: '203.0.113.7',
      } as unknown as Request,
      res as unknown as Response,
      { code: 'code16chars00000', state },
    );
    return res;
  };
  const outcomes = () =>
    track.mock.calls.map(
      ([, , meta]: [null, string, { outcome: string }]) => meta.outcome,
    );
  /** Шаг 1 (GET /api/auth/yandex): куда увели браузер и что легло в куку. */
  const start = (webUser?: { userId: bigint; viaLinkToken: boolean }) => {
    const res = { redirect: jest.fn(), cookie: jest.fn() };
    flow.oauthRedirect(
      'yandex',
      {
        headers: { host: 'schemehappens.ru' },
        query: {},
        originalUrl: '/api/auth/yandex',
        webUser,
      } as unknown as Request,
      res as unknown as Response,
    );
    const [[url]] = res.redirect.mock.calls as [[string]];
    const [[cookieName, cookieValue]] = res.cookie.mock.calls as [
      [string, string],
    ];
    return { to: new URL(url), cookieName, cookieValue };
  };
  return {
    auth,
    flow,
    providers,
    users,
    issued,
    notice,
    comeBack,
    outcomes,
    start,
  };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('шов: старт входа через Яндекс', () => {
  it('вход: ссылка на oauth.yandex.ru без force_confirm, state в ссылке — тот же, что в куке', () => {
    const s = build();
    const { to, cookieName, cookieValue } = s.start();

    expect(to.origin + to.pathname).toBe('https://oauth.yandex.ru/authorize');
    expect(to.searchParams.get('redirect_uri')).toBe(ENV.YANDEX_REDIRECT_URI);
    expect(to.searchParams.has('force_confirm')).toBe(false);
    expect(cookieName).toBe('oauth_state');
    // Яндекс возвращает state как есть — колбэк сверит его с кукой байт в байт.
    expect(to.searchParams.get('state')).toBe(cookieValue);
    expect(s.flow.linkUserIdFromState(cookieValue)).toBeNull();
  });

  it('привязка (кука link_token): выбор аккаунта принудительно, linkUserId — внутри подписи state', () => {
    const s = build();
    const { to, cookieValue } = s.start({ userId: 42n, viaLinkToken: true });

    expect(to.searchParams.get('force_confirm')).toBe('yes');
    expect(s.flow.linkUserIdFromState(cookieValue)).toBe(42n);
  });

  it('сессия без куки link_token — это вход, а не привязка', () => {
    const s = build();
    const { to, cookieValue } = s.start({ userId: 42n, viaLinkToken: false });

    expect(to.searchParams.has('force_confirm')).toBe(false);
    expect(s.flow.linkUserIdFromState(cookieValue)).toBeNull();
  });
});

describe('шов: вход через Яндекс', () => {
  it('первый вход заводит аккаунт, второй находит его же (read-after-write)', async () => {
    const s = build();

    yandexAnswers();
    const first = await s.comeBack(null);
    yandexAnswers();
    await s.comeBack(null);

    expect(first.redirect).toHaveBeenCalledWith(`${BASE}/auth/callback`);
    expect(s.issued).toHaveLength(2);
    expect(s.issued[1]).toBe(s.issued[0]);
    expect(s.users).toHaveLength(1);
    expect(s.providers).toHaveLength(1);
    expect(s.providers[0]).toEqual(
      expect.objectContaining({
        provider: 'yandex',
        providerId: PROFILE.id,
        userId: s.issued[0],
      }),
    );
    // Имя — открыто в User.firstName, без фамилии; почта входа — шифротекстом.
    // Больше из профиля не сохраняется ничего: ни логина, ни фамилии, ни psuid.
    expect(s.users[0]).toEqual({
      id: s.issued[0],
      firstName: PROFILE.first_name,
    });
    expect(Object.keys(s.providers[0]).sort()).toEqual(
      ['displayName', 'email', 'id', 'provider', 'providerId', 'userId'].sort(),
    );
    expect(s.providers[0].email).not.toBe(PROFILE.default_email);
    expect(s.outcomes()).toEqual(['signed_up', 'signed_in']);
  });

  it('привязка: state с linkUserId привязывает Яндекс к этому аккаунту, и вход через Яндекс ведёт в него же', async () => {
    const s = build();
    const owner = await s.auth.findOrCreateUserByProvider(
      'email',
      'owner@example.com',
    );

    yandexAnswers();
    const linked = await s.comeBack(owner);
    yandexAnswers();
    await s.comeBack(null);

    expect(linked.redirect).toHaveBeenCalledWith(`${BASE}/auth/callback`);
    expect(s.issued).toEqual([owner, owner]);
    expect(s.users).toHaveLength(1);
    expect(s.providers.map((p) => [p.provider, p.userId]).sort()).toEqual([
      ['email', owner],
      ['yandex', owner],
    ]);
    expect(s.notice.linked).toHaveBeenCalledWith(owner, 'yandex');
    expect(s.outcomes()).toEqual(['linked', 'signed_in']);
  });

  it('другой аккаунт Яндекса (другой id) — другой пользователь, даже с той же почтой', async () => {
    const s = build();
    yandexAnswers();
    await s.comeBack(null);
    yandexAnswers({ id: '9876543210' });
    await s.comeBack(null);

    expect(s.issued[1]).not.toBe(s.issued[0]);
    expect(s.users).toHaveLength(2);
  });
});

// Решается в AuthService.findOrCreateUserByProvider (поиск только по ключу
// provider+providerId) — поэтому тест бьёт по AuthFlowService поверх него,
// одинаково для обоих провайдеров.
describe('решение 2026-11-12: склейки по почте нет', () => {
  const EMAIL = 'same@example.com';

  it.each(['vk', 'yandex'])(
    '%s: почта совпала с аккаунтом входа по почте — заводится НОВЫЙ пользователь',
    async (provider) => {
      const s = build();
      const byEmail = await s.auth.findOrCreateUserByProvider(
        'email',
        EMAIL,
        undefined,
        EMAIL,
      );

      const outcome = await s.flow.signInOrLinkOrMerge(
        provider,
        { providerId: '777', email: EMAIL, displayName: 'Иван' },
        { linkUserId: null },
      );

      expect(outcome.kind).toBe('tokens');
      const signedIn = (outcome as { userId: bigint }).userId;
      expect(signedIn).not.toBe(byEmail);
      expect(s.users).toHaveLength(2);
      // Строка входа по почте осталась у прежнего владельца.
      expect(s.providers.find((p) => p.provider === 'email')?.userId).toBe(
        byEmail,
      );
      expect(s.providers.find((p) => p.provider === provider)?.userId).toBe(
        signedIn,
      );
    },
  );

  it.each([
    ['vk', 'yandex'],
    ['yandex', 'vk'],
  ])(
    'вход через %s, затем через %s с той же почтой — два разных пользователя',
    async (firstProvider, secondProvider) => {
      const s = build();
      const identity = { providerId: '777', email: EMAIL };
      const a = await s.flow.signInOrLinkOrMerge(firstProvider, identity, {
        linkUserId: null,
      });
      const b = await s.flow.signInOrLinkOrMerge(secondProvider, identity, {
        linkUserId: null,
      });
      expect((b as { userId: bigint }).userId).not.toBe(
        (a as { userId: bigint }).userId,
      );
      expect(s.users).toHaveLength(2);
    },
  );
});
