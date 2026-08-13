// H1 (аудит 2026-08, docs/security/AUDIT_2026-08-12.md): consumeEmailToken
// переехал из AuthService в EmailTokenService — magic-link LOGIN теперь
// гейтится TOTP, если он включён у пользователя (link_email_auth — нет, это
// подтверждение из уже своей почты, не аутентификация). Тесты перенесены
// сюда из auth.service.spec.ts (жили как
// `describe('AuthService — consumeEmailToken')`) и адаптированы под
// discriminated union EmailConsumeResult; `consumeEmailLoginToken`-алиас
// удалён вместе с методом.
//
// Сервис под тестом собран из РЕАЛЬНЫХ коллабораторов (AuthService,
// TotpService) поверх одной общей фейковой Prisma — consumeEmailToken
// делегирует issueTokens/linkProviderToUser/buildTotpChallengeToken
// настоящей логике AuthService, а 2FA-гейт читает настоящую
// TotpService.isEnabled, а не моки.
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { EmailTokenService, EmailConsumeResult } from './email-token.service';
import {
  createFakeTable,
  createFakeTransaction,
  Row,
} from '../test-support/fake-prisma.spec-helper';
import { decrypt } from '../utils/crypto';

// decrypt обёрнут в jest.fn (реальная реализация по умолчанию через
// requireActual) — нужно точечно замокать возврат null для теста на
// LogicalOperator-мутант (`?? row.email` vs `&& row.email`): реальный
// decrypt() никогда не возвращает null для непустой строки, поэтому иначе
// эту ветку не отличить от `&&` (тот же приём, что в auth.service.spec.ts).
jest.mock('../utils/crypto', () => {
  const actual = jest.requireActual('../utils/crypto');
  return { ...actual, decrypt: jest.fn(actual.decrypt) };
});

const JWT_SECRET = 'test-jwt-secret';
const BOT_TOKEN = '12345:TEST_TOKEN';
const FIXED_DATE = new Date('2026-07-16T12:00:00.000Z');

// Тот же общий stateful-фейк, что в auth.service.spec.ts (fake-prisma.spec-helper).
function makeFakePrisma() {
  const webSessions: Row[] = [];
  const authProviders: Row[] = [];
  const users: Row[] = [];
  const emailTokens: Row[] = [];

  const emailToken = createFakeTable(emailTokens, {
    defaults: { usedAt: null },
  });
  const webSession = createFakeTable(webSessions, {
    defaults: { revokedAt: null },
  });
  const authProvider = createFakeTable(authProviders);
  const user = createFakeTable(users);

  // any — сервисы ждут PrismaService, тесты кастуют методы таблиц в jest.Mock.
  const prisma: any = { emailToken, webSession, authProvider, user };
  prisma.$transaction = createFakeTransaction<Row>(prisma);

  return { prisma, webSessions, authProviders, users, emailTokens };
}

function makeService() {
  const { prisma, webSessions, authProviders, users, emailTokens } =
    makeFakePrisma();
  const defaults = {
    JWT_SECRET,
    BOT_TOKEN,
    WEBAPP_URL: 'https://schemehappens.ru',
  };
  const config = {
    getOrThrow: (k: string) => defaults[k as keyof typeof defaults],
  } as any;
  const securityLog = { log: jest.fn() } as any;
  const emailSvc = {
    sendLoginLink: jest.fn().mockResolvedValue(undefined),
  } as any;
  const auth = new AuthService(prisma, config, securityLog, emailSvc);
  const totp = new TotpService(prisma);
  const svc = new EmailTokenService(prisma, auth, totp);
  return {
    svc,
    auth,
    totp,
    prisma,
    webSessions,
    authProviders,
    users,
    emailTokens,
    securityLog,
    emailSvc,
  };
}

// Достаёт сырой токен из последней вызванной ссылки sendLoginLink — линк вида
// ".../api/auth/email/callback?token=<raw>". emailSvc живёт на AuthService —
// requestEmailLogin/linkEmailToAccount (выдача токена) там и остались.
function extractTokenFromLink(auth: AuthService): string {
  const emailSvc = (auth as any).emailSvc;
  const link: string =
    emailSvc.sendLoginLink.mock.calls[
      emailSvc.sendLoginLink.mock.calls.length - 1
    ][1];
  return new URL(link).searchParams.get('token')!;
}

function assertTokens(
  result: EmailConsumeResult,
): asserts result is Extract<EmailConsumeResult, { kind: 'tokens' }> {
  if (result.kind !== 'tokens')
    throw new Error(`expected kind=tokens, got ${result.kind}`);
}

function assertChallenge(
  result: EmailConsumeResult,
): asserts result is Extract<EmailConsumeResult, { kind: 'totp_challenge' }> {
  if (result.kind !== 'totp_challenge')
    throw new Error(`expected kind=totp_challenge, got ${result.kind}`);
}

beforeEach(() => jest.useFakeTimers({ now: FIXED_DATE }));

afterEach(() => jest.useRealTimers());

describe('EmailTokenService — consumeEmailToken', () => {
  it('пустой токен → именно "Missing token" (не проваливается в "Token not found")', async () => {
    const { svc } = makeService();
    await expect(svc.consumeEmailToken('')).rejects.toThrow('Missing token');
  });

  it('неизвестный токен → UnauthorizedException', async () => {
    const { svc } = makeService();
    await expect(svc.consumeEmailToken('garbage')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('чужой (гарбаж) токен не находит СУЩЕСТВУЮЩИЙ в таблице чужой токен — findUnique обязан фильтровать по tokenHash, а не отдавать первую строку', async () => {
    const { svc, auth, emailTokens } = makeService();
    await auth.requestEmailLogin('victim@example.com'); // легитимная запись уже есть
    expect(emailTokens).toHaveLength(1);
    await expect(
      svc.consumeEmailToken('completely-unrelated-garbage-token'),
    ).rejects.toThrow('Token not found');
  });

  it('expiresAt ровно равен текущему моменту (граница) → ещё НЕ истёк, потребляется успешно', async () => {
    const { svc, auth, emailTokens } = makeService();
    await auth.requestEmailLogin('boundary@example.com');
    emailTokens[0].expiresAt = new Date(FIXED_DATE.getTime());
    const raw = extractTokenFromLink(auth);
    const result = await svc.consumeEmailToken(raw);
    assertTokens(result);
    expect(result.purpose).toBe('login');
  });

  it('второй потреблённый токен не помечает usedAt у первого (соседнего) — update обязан фильтровать по id, а не брать первую строку', async () => {
    const { svc, auth, emailTokens } = makeService();
    await auth.requestEmailLogin('first@example.com');
    await auth.requestEmailLogin('second@example.com');
    expect(emailTokens).toHaveLength(2);
    // Достаём токен именно ВТОРОГО письма (последний вызов sendLoginLink).
    const raw = extractTokenFromLink(auth);
    await svc.consumeEmailToken(raw);
    expect(emailTokens[0].usedAt).toBeNull(); // первый (соседний) не тронут
    expect(emailTokens[1].usedAt).not.toBeNull(); // второй — потреблён
  });

  it('уже использованный токен → UnauthorizedException', async () => {
    const { svc, auth } = makeService();
    await auth.requestEmailLogin('used@example.com');
    const raw = extractTokenFromLink(auth);
    await svc.consumeEmailToken(raw);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('просроченный токен → UnauthorizedException', async () => {
    const { svc, auth, emailTokens } = makeService();
    await auth.requestEmailLogin('expired@example.com');
    emailTokens[0].expiresAt = new Date(FIXED_DATE.getTime() - 1000);
    const raw = extractTokenFromLink(auth);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('токен с неизвестным purpose → UnauthorizedException', async () => {
    const { svc, auth, emailTokens } = makeService();
    await auth.requestEmailLogin('badpurpose@example.com');
    emailTokens[0].purpose = 'something_else';
    const raw = extractTokenFromLink(auth);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('токен без userId → UnauthorizedException', async () => {
    const { svc, auth, emailTokens } = makeService();
    await auth.requestEmailLogin('nouser@example.com');
    emailTokens[0].userId = null;
    const raw = extractTokenFromLink(auth);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('purpose=login → возвращает токены, помечает использованным, НЕ заходит в ветку link_email_auth (linkProviderToUser не вызывается)', async () => {
    const { svc, auth, prisma, emailTokens } = makeService();
    await auth.requestEmailLogin('login@example.com');
    // requestEmailLogin уже дёрнул authProvider.findUnique один раз внутри
    // findOrCreateUserByProvider — фиксируем счётчик ДО consumeEmailToken.
    const callsBefore = (prisma.authProvider.findUnique as jest.Mock).mock.calls
      .length;
    const raw = extractTokenFromLink(auth);
    const result = await svc.consumeEmailToken(raw);
    assertTokens(result);
    expect(result.purpose).toBe('login');
    expect(result.tokens.accessToken).toBeDefined();
    expect(emailTokens[0].usedAt).not.toBeNull();
    // purpose='login' не должен заходить в ветку link_email_auth —
    // linkProviderToUser (и его findUnique) не вызывается лишний раз.
    expect(
      (prisma.authProvider.findUnique as jest.Mock).mock.calls.length,
    ).toBe(callsBefore);
  });

  it('purpose=link_email_auth → привязывает email к целевому userId', async () => {
    const { svc, auth, authProviders } = makeService();
    await auth.linkEmailToAccount(42n, 'link@example.com');
    const raw = extractTokenFromLink(auth);
    const result = await svc.consumeEmailToken(raw);
    expect(result.purpose).toBe('link_email_auth');
    expect(
      authProviders.some(
        (p) => p.provider === 'email' && String(p.userId) === '42',
      ),
    ).toBe(true);
  });

  it('decField(row.email) вернул null (напр. чужой ключ шифрования) → привязывается сырое row.email, не null (?? а не &&)', async () => {
    const { svc, auth, authProviders } = makeService();
    await auth.linkEmailToAccount(77n, 'decrypt-fallback@example.com');
    const raw = extractTokenFromLink(auth);
    (decrypt as jest.Mock).mockReturnValueOnce(null);
    const result = await svc.consumeEmailToken(raw);
    expect(result.purpose).toBe('link_email_auth');
    expect(
      authProviders.some(
        (p) =>
          p.provider === 'email' &&
          p.providerId === 'decrypt-fallback@example.com',
      ),
    ).toBe(true);
  });

  it('purpose=link_email_auth, email привязался к другому userId между отправкой и переходом по ссылке (race) → ConflictException', async () => {
    const { svc, emailTokens, authProviders } = makeService();
    // Токен уже выпущен (пользователь получил письмо), но прежде чем он
    // перешёл по ссылке — email успел стать AuthProvider'ом другого userId
    // (напр. параллельный login тем же email). consumeEmailToken должен
    // отклонить привязку, а не молча перезаписать чужой провайдер.
    const raw = 'test-race-raw-token';
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    emailTokens.push({
      id: 'et-race',
      userId: 999999n,
      tokenHash,
      email: 'taken@example.com',
      purpose: 'link_email_auth',
      expiresAt: new Date(FIXED_DATE.getTime() + 100_000),
      usedAt: null,
    });
    authProviders.push({
      id: 1,
      userId: 111n,
      provider: 'email',
      providerId: 'taken@example.com',
    });
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(ConflictException);
  });
});

describe('EmailTokenService — 2FA-гейт при login (H1)', () => {
  it('purpose=login, у пользователя включён TOTP → kind:"totp_challenge", challengeToken расшифровывается на тот же userId', async () => {
    const { svc, auth, users, emailTokens } = makeService();
    await auth.requestEmailLogin('twofa@example.com');
    const userId = emailTokens[0].userId as bigint;
    // isEnabled (totp.service.ts) смотрит только totpEnabledAt — totpSecret
    // добавлен для реалистичности состояния «2FA включена».
    Object.assign(users[0], {
      totpEnabledAt: FIXED_DATE,
      totpSecret: 'enc-secret',
    });
    const raw = extractTokenFromLink(auth);
    const result = await svc.consumeEmailToken(raw);
    assertChallenge(result);
    expect(auth.verifyTotpChallengeToken(result.challengeToken).userId).toBe(
      userId,
    );
    // Токен погашен, несмотря на то что сессия ещё не выдана — по той же
    // magic-link ссылке нельзя пройти дважды.
    expect(emailTokens[0].usedAt).not.toBeNull();
  });

  it('purpose=link_email_auth, у пользователя включён TOTP → всё равно kind:"tokens" (привязка почты не гейтится 2FA)', async () => {
    const { svc, auth, users } = makeService();
    users.push({
      id: 55n,
      totpEnabledAt: FIXED_DATE,
      totpSecret: 'enc-secret',
    });
    await auth.linkEmailToAccount(55n, 'linked-2fa@example.com');
    const raw = extractTokenFromLink(auth);
    const result = await svc.consumeEmailToken(raw);
    assertTokens(result);
    expect(result.purpose).toBe('link_email_auth');
  });
});
