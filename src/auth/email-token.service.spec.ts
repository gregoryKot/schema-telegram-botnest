// Погашение ссылки привязки почты (EmailTokenService.consumeEmailToken).
// Входа по ссылке на почту нет (решение владельца, ч. 10 ст. 8 149-ФЗ): сервис
// гасит только link_email_auth и сессию не выдаёт никогда.
//
// Сервис под тестом собран из РЕАЛЬНОГО AuthService поверх одной общей
// фейковой Prisma: токен выписывает настоящий linkEmailToAccount, привязку
// делает настоящий linkProviderToUser, а не моки.
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { LinkSessionRequiredException } from './link-session-required.exception';
import { EmailTokenService } from './email-token.service';
import {
  createFakeTable,
  createFakeTransaction,
  Row,
} from '../test-support/fake-prisma.spec-helper';
import { decrypt } from '../utils/crypto';

// decrypt обёрнут в jest.fn (реальная реализация по умолчанию) — чтобы
// точечно вернуть null и отличить `?? row.email` от `&& row.email`.
jest.mock('../utils/crypto', () => {
  const actual = jest.requireActual('../utils/crypto');
  return { ...actual, decrypt: jest.fn(actual.decrypt) };
});

const FIXED_DATE = new Date('2026-07-16T12:00:00.000Z');
const OWNER = 42n;

function makeService() {
  const webSessions: Row[] = [];
  const authProviders: Row[] = [];
  const emailTokens: Row[] = [];
  const emailToken = createFakeTable(emailTokens, {
    defaults: { usedAt: null },
  });
  const webSession = createFakeTable(webSessions, {
    defaults: { revokedAt: null },
  });
  const authProvider = createFakeTable(authProviders);
  const user = createFakeTable([]);
  // any — сервисы ждут PrismaService, тесты кастуют методы таблиц в jest.Mock.
  const prisma: any = { emailToken, webSession, authProvider, user };
  prisma.$transaction = createFakeTransaction<Row>(prisma);

  const env: Record<string, string> = {
    JWT_SECRET: 'test-jwt-secret',
    WEBAPP_URL: 'https://schemehappens.ru',
  };
  const config = { getOrThrow: (k: string) => env[k] } as any;
  const emailSvc = {
    sendLinkEmailLetter: jest.fn().mockResolvedValue(undefined),
  };
  const securityLog = { log: jest.fn() } as any;
  const auth = new AuthService(prisma, config, securityLog, emailSvc as any);
  const svc = new EmailTokenService(prisma, auth);

  /** Письмо привязки на `email` для `userId`; возвращает сырой токен ссылки. */
  async function linkToken(userId: bigint, email: string): Promise<string> {
    await auth.linkEmailToAccount(userId, email);
    const calls = emailSvc.sendLinkEmailLetter.mock.calls;
    const link = (calls[calls.length - 1] as string[])[1];
    return new URL(link).searchParams.get('token')!;
  }

  return { svc, prisma, webSessions, authProviders, emailTokens, linkToken };
}

/** Строка токена в обход выдачи — для старых токенов и гонок. */
function seedToken(rows: Row[], raw: string, over: Partial<Row> = {}) {
  rows.push({
    id: `et-${rows.length + 1}`,
    userId: OWNER,
    tokenHash: createHash('sha256').update(raw).digest('hex'),
    email: 'seed@example.com',
    purpose: 'link_email_auth',
    expiresAt: new Date(FIXED_DATE.getTime() + 100_000),
    usedAt: null,
    ...over,
  });
}

beforeEach(() => jest.useFakeTimers({ now: FIXED_DATE }));

afterEach(() => jest.useRealTimers());

describe('EmailTokenService — привязка почты', () => {
  it('клик из сессии владельца → адрес привязан, возвращён его userId, сессии нет', async () => {
    const { svc, linkToken, authProviders, webSessions, emailTokens } =
      makeService();
    const raw = await linkToken(OWNER, 'Mine@Example.com');
    await expect(svc.consumeEmailToken(raw, OWNER)).resolves.toBe(OWNER);
    expect(authProviders).toEqual([
      expect.objectContaining({
        userId: OWNER,
        provider: 'email',
        providerId: 'mine@example.com',
      }),
    ]);
    expect(webSessions).toHaveLength(0);
    expect(emailTokens[0].usedAt).not.toBeNull();
  });

  it('пустой токен → именно "Missing token" (не проваливается в "Token not found")', async () => {
    const { svc } = makeService();
    await expect(svc.consumeEmailToken('', OWNER)).rejects.toThrow(
      'Missing token',
    );
  });

  it('чужой токен не находит СУЩЕСТВУЮЩИЙ — findUnique фильтрует по tokenHash', async () => {
    const { svc, linkToken, emailTokens } = makeService();
    await linkToken(OWNER, 'victim@example.com');
    expect(emailTokens).toHaveLength(1);
    await expect(svc.consumeEmailToken('garbage', OWNER)).rejects.toThrow(
      'Token not found',
    );
  });

  it('expiresAt ровно сейчас (граница) → ещё НЕ истёк', async () => {
    const { svc, linkToken, emailTokens } = makeService();
    const raw = await linkToken(OWNER, 'boundary@example.com');
    emailTokens[0].expiresAt = new Date(FIXED_DATE.getTime());
    await expect(svc.consumeEmailToken(raw, OWNER)).resolves.toBe(OWNER);
  });

  it('просроченный токен → UnauthorizedException, адрес не привязан', async () => {
    const { svc, linkToken, emailTokens, authProviders } = makeService();
    const raw = await linkToken(OWNER, 'expired@example.com');
    emailTokens[0].expiresAt = new Date(FIXED_DATE.getTime() - 1000);
    await expect(svc.consumeEmailToken(raw, OWNER)).rejects.toThrow(
      'Token expired',
    );
    expect(authProviders).toHaveLength(0);
  });

  it('второй токен не гасит соседний — updateMany фильтрует по id', async () => {
    const { svc, linkToken, emailTokens } = makeService();
    await linkToken(OWNER, 'first@example.com');
    const raw = await linkToken(OWNER, 'second@example.com');
    await svc.consumeEmailToken(raw, OWNER);
    expect(emailTokens[0].usedAt).toBeNull();
    expect(emailTokens[1].usedAt).not.toBeNull();
  });

  it('повторное погашение → "Token already used"', async () => {
    const { svc, linkToken } = makeService();
    const raw = await linkToken(OWNER, 'used@example.com');
    await svc.consumeEmailToken(raw, OWNER);
    await expect(svc.consumeEmailToken(raw, OWNER)).rejects.toThrow(
      'Token already used',
    );
  });

  it('гонка: оба запроса прочли usedAt=null → второй «уже использован» (L3, CAS)', async () => {
    const { svc, linkToken, prisma, emailTokens } = makeService();
    const raw = await linkToken(OWNER, 'race@example.com');
    // Быстрый if(row.usedAt) обходят оба; ловит только атомарный updateMany.
    jest
      .spyOn(prisma.emailToken, 'findUnique')
      .mockImplementation((args: any) => {
        const row = emailTokens.find(
          (t) => t.tokenHash === args.where.tokenHash,
        );
        return Promise.resolve(row ? { ...row, usedAt: null } : null);
      });
    await expect(svc.consumeEmailToken(raw, OWNER)).resolves.toBe(OWNER);
    await expect(svc.consumeEmailToken(raw, OWNER)).rejects.toThrow(
      'Token already used',
    );
  });

  // Входа по почте нет: токен входа, выписанный до выкладки, не гасится и
  // сессию не даёт; заодно — старые токены восстановления.
  it.each(['login', 'recovery', 'verify_email', 'something_else'])(
    'токен с purpose=%s → 401 "Token purpose mismatch", не погашен',
    async (purpose) => {
      const { svc, emailTokens, webSessions, authProviders } = makeService();
      seedToken(emailTokens, 'old-raw', { purpose, userId: null });
      await expect(svc.consumeEmailToken('old-raw', null)).rejects.toThrow(
        new UnauthorizedException('Token purpose mismatch'),
      );
      expect(emailTokens[0].usedAt).toBeNull();
      expect(webSessions).toHaveLength(0);
      expect(authProviders).toHaveLength(0);
    },
  );

  it('токен входа известного адреса (userId есть) — тоже 401, даже из его сессии', async () => {
    const { svc, emailTokens } = makeService();
    seedToken(emailTokens, 'old-login', { purpose: 'login' });
    await expect(svc.consumeEmailToken('old-login', OWNER)).rejects.toThrow(
      'Token purpose mismatch',
    );
  });

  it('привязка без userId в токене → UnauthorizedException', async () => {
    const { svc, emailTokens } = makeService();
    seedToken(emailTokens, 'no-user', { userId: null });
    await expect(svc.consumeEmailToken('no-user', null)).rejects.toThrow(
      'No user bound to token',
    );
  });

  it('decField(row.email) вернул null → привязывается сырое row.email (?? а не &&)', async () => {
    const { svc, linkToken, authProviders } = makeService();
    const raw = await linkToken(OWNER, 'decrypt-fallback@example.com');
    (decrypt as jest.Mock).mockReturnValueOnce(null);
    await svc.consumeEmailToken(raw, OWNER);
    expect(authProviders[0].providerId).toBe('decrypt-fallback@example.com');
  });

  it('адрес успели привязать к другому аккаунту (race) → ConflictException', async () => {
    const { svc, emailTokens, authProviders } = makeService();
    seedToken(emailTokens, 'taken', { email: 'taken@example.com' });
    authProviders.push({
      id: 1,
      userId: 111n,
      provider: 'email',
      providerId: 'taken@example.com',
    });
    await expect(svc.consumeEmailToken('taken', OWNER)).rejects.toThrow(
      ConflictException,
    );
  });
});

// A3 (аудит 2026-10): письмо привязки уходит на адрес, который ввёл
// ЗАПРОСИВШИЙ, а кликнуть может кто угодно. До фикса клик жертвы привязывал
// её адрес к аккаунту злоумышленника И выдавал жертве сессию этого аккаунта.
describe('EmailTokenService — привязка требует сессии того же аккаунта (A3)', () => {
  const ATTACKER = 666n;
  const VICTIM = 777n;

  it('клик БЕЗ сессии → LinkSessionRequiredException, адрес не привязан, токен НЕ сожжён', async () => {
    const { svc, linkToken, authProviders, emailTokens } = makeService();
    const raw = await linkToken(ATTACKER, 'victim@example.com');
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      LinkSessionRequiredException,
    );
    await expect(svc.consumeEmailToken(raw, null)).rejects.toThrow(
      LinkSessionRequiredException,
    );
    expect(authProviders).toHaveLength(0);
    expect(emailTokens[0].usedAt).toBeNull();
  });

  it('клик из сессии ДРУГОГО аккаунта (жертва) → отказ, привязки нет, сессия не выдана', async () => {
    const { svc, linkToken, authProviders, webSessions } = makeService();
    const raw = await linkToken(ATTACKER, 'victim@example.com');
    await expect(svc.consumeEmailToken(raw, VICTIM)).rejects.toThrow(
      LinkSessionRequiredException,
    );
    expect(authProviders).toHaveLength(0);
    expect(webSessions).toHaveLength(0);
  });
});
