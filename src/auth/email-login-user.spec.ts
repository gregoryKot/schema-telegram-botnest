// Регрессия к снятию входа через Google (2026-11, запрос РКН №08-1063539):
// у человека осталась только строка AuthProvider(provider='google'), он вводит
// ту же почту — и обязан попасть в ТОТ ЖЕ userId, а не в новый пустой аккаунт.
// Сервисы настоящие (AuthService, EmailTokenService, TotpService) поверх
// фейковой Prisma; адрес Google лежит шифротекстом, как в проде.
// crypto.ts читает ключ на загрузке — модули грузим после установки env.
import type { Row } from '../test-support/fake-prisma.spec-helper';

type Auth = import('./auth.service').AuthService;
type Tokens = import('./email-token.service').EmailTokenService;
let mods: {
  AuthService: typeof import('./auth.service').AuthService;
  EmailTokenService: typeof import('./email-token.service').EmailTokenService;
  TotpService: typeof import('./totp.service').TotpService;
  helper: typeof import('../test-support/fake-prisma.spec-helper');
  find: typeof import('./email-login-user').findLegacyGoogleUserId;
};

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  mods = {
    AuthService: require('./auth.service').AuthService,
    EmailTokenService: require('./email-token.service').EmailTokenService,
    TotpService: require('./totp.service').TotpService,
    helper: require('../test-support/fake-prisma.spec-helper'),
    find: require('./email-login-user').findLegacyGoogleUserId,
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
});

function make() {
  const providers: Row[] = [];
  const users: Row[] = [];
  const sendLoginLink = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    authProvider: mods.helper.createFakeTable(providers),
    user: mods.helper.createFakeTable(users),
    emailToken: mods.helper.createFakeTable([], {
      defaults: { usedAt: null },
    }),
    webSession: mods.helper.createFakeTable([], {
      defaults: { revokedAt: null },
    }),
  } as never;
  const config = {
    getOrThrow: (k: string) =>
      k === 'WEBAPP_URL' ? 'https://schemehappens.ru' : 'test-secret',
  } as never;
  const auth: Auth = new mods.AuthService(
    prisma,
    config,
    { log: jest.fn() } as never,
    { sendLoginLink, sendLinkEmailLetter: jest.fn() } as never,
  );
  const totp = new mods.TotpService(prisma, {
    lockedFor: jest.fn().mockResolvedValue(0),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  } as never);
  const tokens: Tokens = new mods.EmailTokenService(prisma, auth, totp);
  /** Запрос письма + переход по ссылке из него. */
  const loginByEmail = async (email: string) => {
    await auth.requestEmailLogin(email);
    const link = (sendLoginLink.mock.calls.at(-1) as string[])[1];
    return tokens.consumeEmailToken(new URL(link).searchParams.get('token')!);
  };
  return { auth, prisma, providers, users, loginByEmail };
}

describe('вход по почте после снятия входа через Google', () => {
  it('google-пользователь → ссылка на почту → тот же userId, новых аккаунтов нет', async () => {
    const { auth, providers, users, loginByEmail } = make();
    const googleUserId = await auth.findOrCreateUserByProvider(
      'google',
      'google-sub-1',
      'Аня',
      'Anya@Gmail.com',
    );
    expect(providers[0].email).not.toContain('@'); // в базе — шифротекст

    const result = await loginByEmail('anya@gmail.com');

    expect(result.kind).toBe('tokens');
    expect(result.userId).toBe(googleUserId);
    expect(users).toHaveLength(1);
    // Строка Google на месте, рядом появился вход по почте того же аккаунта.
    expect(providers.map((p) => [p.provider, p.providerId, p.userId])).toEqual([
      ['google', 'google-sub-1', googleUserId],
      ['email', 'anya@gmail.com', googleUserId],
    ]);
  });

  it('повторный вход идёт уже по строке email — снова тот же userId', async () => {
    const { auth, providers, users, loginByEmail } = make();
    const googleUserId = await auth.findOrCreateUserByProvider(
      'google',
      'google-sub-1',
      undefined,
      'anya@gmail.com',
    );
    await loginByEmail('anya@gmail.com');
    const again = await loginByEmail('ANYA@gmail.com');
    expect(again.userId).toBe(googleUserId);
    expect(users).toHaveLength(1);
    expect(providers).toHaveLength(2);
  });

  it('чужой адрес к Google-аккаунту не подходит: заводится отдельный аккаунт', async () => {
    const { auth, users, loginByEmail } = make();
    const googleUserId = await auth.findOrCreateUserByProvider(
      'google',
      'google-sub-1',
      undefined,
      'anya@gmail.com',
    );
    const result = await loginByEmail('nya@gmail.com');
    expect(result.userId).not.toBe(googleUserId);
    expect(users).toHaveLength(2);
  });

  it('адрес других провайдеров (VK) не даёт входа в их аккаунт', async () => {
    const { auth, loginByEmail } = make();
    const vkUserId = await auth.findOrCreateUserByProvider(
      'vk',
      'vk-1',
      'Аня',
      'anya@gmail.com',
    );
    const result = await loginByEmail('anya@gmail.com');
    expect(result.userId).not.toBe(vkUserId);
  });

  it('один адрес у двух Google-аккаунтов — не угадываем, чей он', async () => {
    const { auth, prisma } = make();
    await auth.findOrCreateUserByProvider('google', 's1', undefined, 'a@x.ru');
    await auth.findOrCreateUserByProvider('google', 's2', undefined, 'a@x.ru');
    expect(await mods.find(prisma, 'a@x.ru')).toBeNull();
  });

  it('строка Google без адреса и старая строка открытым текстом читаются', async () => {
    const { auth, prisma, providers } = make();
    await auth.findOrCreateUserByProvider('google', 's1');
    const id = await auth.findOrCreateUserByProvider('google', 's2');
    providers[1].email = 'Old@x.ru'; // до волны дошифровки
    expect(await mods.find(prisma, 'old@x.ru')).toBe(id);
    expect(await mods.find(prisma, 'none@x.ru')).toBeNull();
  });
});
