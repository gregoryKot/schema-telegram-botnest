// D-9 (аудит 2026-10): AuthProvider.email/displayName — PII, в БД они лежат
// шифротекстом. Писатели в AuthService обязаны идти через
// utils/auth-provider-crypto (иначе новые строки снова открытым текстом, а
// волна дошифровки гонится за ними вечно), читатель — расшифровывать.
// crypto.ts читает ключ на загрузке — модули грузим после установки env.
import type { Row } from '../test-support/fake-prisma.spec-helper';

type Svc = import('./auth.service').AuthService;
let AuthServiceCtor: typeof import('./auth.service').AuthService;
let helper: typeof import('../test-support/fake-prisma.spec-helper');
let dec: (v: string | null | undefined) => string | null;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'ef'.repeat(32);
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  AuthServiceCtor = (
    require('./auth.service') as typeof import('./auth.service')
  ).AuthService;
  helper = require('../test-support/fake-prisma.spec-helper');
  dec = (require('../utils/crypto') as typeof import('../utils/crypto'))
    .decrypt;
  /* eslint-enable @typescript-eslint/no-require-imports */
});

function make(): { svc: Svc; providers: Row[] } {
  const providers: Row[] = [];
  const users: Row[] = [];
  const prisma = {
    authProvider: helper.createFakeTable(providers),
    user: helper.createFakeTable(users),
  } as never;
  const config = {
    getOrThrow: (k: string) => (k === 'JWT_SECRET' ? 's' : 'x'),
  } as never;
  const svc = new AuthServiceCtor(
    prisma,
    config,
    { log: jest.fn() } as never,
    {} as never,
  );
  return { svc, providers };
}

describe('AuthService — шифрование PII провайдера (D-9)', () => {
  it('findOrCreateUserByProvider: новая строка — email и имя шифротекстом, providerId открыт', async () => {
    const { svc, providers } = make();
    await svc.findOrCreateUserByProvider('google', 'sub-1', 'Аня', 'a@x.ru');
    expect(providers).toHaveLength(1);
    expect(providers[0].providerId).toBe('sub-1');
    expect(providers[0].email).not.toBe('a@x.ru');
    expect(providers[0].displayName).not.toBe('Аня');
    expect(dec(providers[0].email as string)).toBe('a@x.ru');
    expect(dec(providers[0].displayName as string)).toBe('Аня');
  });

  it('повторный вход с новым именем: обновление тоже шифротекстом', async () => {
    const { svc, providers } = make();
    await svc.findOrCreateUserByProvider('google', 'sub-1', 'Аня', 'a@x.ru');
    await svc.findOrCreateUserByProvider('google', 'sub-1', 'Анна', 'a@x.ru');
    expect(providers[0].displayName).not.toBe('Анна');
    expect(dec(providers[0].displayName as string)).toBe('Анна');
  });

  it('linkProviderToUser: create — шифротекстом', async () => {
    const { svc, providers } = make();
    await svc.linkProviderToUser(5n, 'vk', 'vk-9', 'Боря', 'b@x.ru');
    expect(providers[0].email).not.toBe('b@x.ru');
    expect(dec(providers[0].email as string)).toBe('b@x.ru');
    expect(dec(providers[0].displayName as string)).toBe('Боря');
  });

  it('getUserProviders отдаёт расшифрованное (для QR-метки 2FA), в том числе старые строки открытым текстом', async () => {
    const { svc, providers } = make();
    await svc.linkProviderToUser(5n, 'vk', 'vk-9', 'Боря', 'b@x.ru');
    providers.push({
      id: 99,
      userId: 5n,
      provider: 'google',
      providerId: 'old',
      email: 'old@x.ru',
      displayName: 'Старая',
    });
    const rows = await svc.getUserProviders(5n);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'b@x.ru', displayName: 'Боря' }),
        expect.objectContaining({ email: 'old@x.ru', displayName: 'Старая' }),
      ]),
    );
  });
});
