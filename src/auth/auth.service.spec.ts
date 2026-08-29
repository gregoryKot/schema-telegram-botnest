// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md, п.5): AuthService — ротация
// refresh-токенов (reuse-детекция кражи), подпись initData (regression на
// RangeError вместо 401), генерация userId, merge-токены. Prisma — стейтфулый
// in-memory фейк; подпись пересчитана как в telegram-auth.guard.spec.ts.
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHmac, createHash } from 'crypto';
import * as cryptoModule from 'crypto';
// randomBytes обёрнут в jest.fn (по умолчанию — реальная реализация через
// requireActual) только затем, чтобы в одном тесте (ArithmeticOperator на
// generateWebUserId) подменить её возврат детерминированным буфером — сам
// built-in модуль 'crypto' нередактируем через jest.spyOn напрямую
// (Cannot redefine property), поэтому подменяем на уровне module registry.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomBytes: jest.fn(actual.randomBytes) };
});
import { AuthService } from './auth.service';
import {
  createFakeTable,
  createFakeTransaction,
  Row,
} from '../test-support/fake-prisma.spec-helper';
// encrypt обёрнут в jest.fn (реальная реализация по умолчанию через
// requireActual) — нужно точечно замокать возврат null в паре тестов на
// LogicalOperator-мутанты (`?? lower` vs `&& lower`): реальный encrypt()
// никогда не возвращает null для непустой строки, поэтому иначе эту ветку
// не отличить от `&&`. decrypt здесь не нужен — AuthService его не вызывает
// (decField(row.email)-тест переехал в email-token.service.spec.ts вместе с
// consumeEmailToken).
import { encrypt } from '../utils/crypto';

jest.mock('../utils/crypto', () => {
  const actual = jest.requireActual('../utils/crypto');
  return { ...actual, encrypt: jest.fn(actual.encrypt) };
});

const JWT_SECRET = 'test-jwt-secret';
const BOT_TOKEN = '12345:TEST_TOKEN';
const FIXED_DATE = new Date('2026-07-16T12:00:00.000Z');
const WEB_USER_ID_MIN = 1_000_000_000_000_000n;
const WEB_USER_ID_MAX = 9_000_000_000_000_000n;

// hash: undefined = подписать честно; 'omit' = без hash; иначе — как есть.
function signInitData(opts: {
  user?: unknown;
  authDate?: number;
  botToken?: string;
  hash?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.user !== undefined) params.set('user', JSON.stringify(opts.user));
  params.set(
    'auth_date',
    String(opts.authDate ?? Math.floor(Date.now() / 1000)),
  );
  if (opts.hash === 'omit') return params.toString();
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData')
    .update(opts.botToken ?? BOT_TOKEN)
    .digest();
  const correct = createHmac('sha256', secret)
    .update(checkString)
    .digest('hex');
  params.set('hash', opts.hash ?? correct);
  return params.toString();
}

// Общий stateful-фейк (src/test-support/fake-prisma.spec-helper.ts, этап 2.4
// TEST_IMPROVEMENT_PLAN.md) — where-матчинг (в т.ч. составной unique-ключ
// `provider_providerId`/`id`, `select` на findMany) заменяет прежний
// рукописный `matchesWhere` + 4 таблицы с индивидуальной логикой. Массивы
// (`webSessions`/`authProviders`/…) — те же ссылки, что и `._rows` таблиц,
// тесты по-прежнему мутируют их напрямую (`authProviders.push(...)`).
function makeFakePrisma() {
  const webSessions: Row[] = [];
  const authProviders: Row[] = [];
  const users: Row[] = [];
  const emailTokens: Row[] = [];

  const emailToken = createFakeTable(emailTokens, {
    defaults: { usedAt: null },
  });
  const webSession = createFakeTable(webSessions, {
    defaults: { revokedAt: null, replacedByHash: null },
  });
  const authProvider = createFakeTable(authProviders);
  const user = createFakeTable(users);

  // any — как и в остальном файле: сервис ждёт PrismaService, тесты дальше
  // напрямую кастуют методы таблиц в jest.Mock (mockImplementationOnce и т.п.).
  const prisma: any = { emailToken, webSession, authProvider, user };
  prisma.$transaction = createFakeTransaction<Row>(prisma);

  return { prisma, webSessions, authProviders, users, emailTokens };
}

function makeService(
  configOverrides: Partial<{
    JWT_SECRET: string;
    BOT_TOKEN: string;
    WEBAPP_URL: string;
  }> = {},
) {
  const { prisma, webSessions, authProviders, users, emailTokens } =
    makeFakePrisma();
  const defaults = {
    JWT_SECRET,
    BOT_TOKEN,
    WEBAPP_URL: 'https://schemehappens.ru',
  };
  const config = {
    // Ключ намеренно валидируется (не игнорируется) — так тест ловит
    // StringLiteral-мутацию имени env-ключа ('JWT_SECRET' → ''): запрос
    // несуществующего ключа возвращает undefined, а не тот же секрет.
    getOrThrow: (k: string) =>
      ({ ...defaults, ...configOverrides })[k as keyof typeof defaults],
  } as any;
  const securityLog = { log: jest.fn() } as any;
  const emailSvc = {
    sendLoginLink: jest.fn().mockResolvedValue(undefined),
  } as any;
  const svc = new AuthService(prisma, config, securityLog, emailSvc);
  return {
    svc,
    prisma,
    webSessions,
    authProviders,
    users,
    emailTokens,
    securityLog,
    emailSvc,
  };
}

beforeEach(() => jest.useFakeTimers({ now: FIXED_DATE }));

afterEach(() => jest.useRealTimers());

describe('AuthService — refresh-token rotation', () => {
  it('issueTokens хранит только хэш; rotateRefreshToken меняет токен ровно один раз', async () => {
    const { svc, webSessions } = makeService();
    const issued = await svc.issueTokens(1n, '1.1.1.1', 'ua');
    expect(webSessions).toHaveLength(1);
    expect(webSessions[0].tokenHash).not.toBe(issued.refreshToken); // сырой токен нигде не хранится
    expect(webSessions[0].tokenHash).toHaveLength(64); // sha256 hex
    expect(issued.expiresIn).toBe(15 * 60);
    // REFRESH_TOKEN_TTL_S = 30*24*3600 — ровно 30 дней вперёд, не 0.2с и не
    // 1.25с, как дала бы поломанная арифметика (30*24/3600 или 30/24).
    expect((webSessions[0].expiresAt as Date).getTime()).toBe(
      FIXED_DATE.getTime() + 30 * 24 * 3600 * 1000,
    );

    const rotated = await svc.rotateRefreshToken(issued.refreshToken);
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    expect(webSessions).toHaveLength(2);
    expect(webSessions[0].revokedAt).toEqual(FIXED_DATE); // старая отозвана
    expect(webSessions[1].revokedAt).toBeNull(); // новая жива
    expect(webSessions[1].family).toBe(webSessions[0].family);
    // Новый expiresAt тоже ровно +30 дней ВПЕРЁД (а не назад, как дала бы
    // мутация "+" → "-", и не сломанная арифметика TTL/1000).
    expect((webSessions[1].expiresAt as Date).getTime()).toBe(
      FIXED_DATE.getTime() + 30 * 24 * 3600 * 1000,
    );
  });

  it('rotateRefreshToken ищет сессию именно по своему tokenHash, а не берёт первую строку таблицы (иначе можно получить чужой accessToken)', async () => {
    const { svc } = makeService();
    await svc.issueTokens(2n); // окажется первой строкой в таблице
    const mine = await svc.issueTokens(1n);
    const rotated = await svc.rotateRefreshToken(mine.refreshToken);
    // Идентичность нового accessToken — от МОЕГО userId, не от первой строки.
    expect(svc.verifyAccessToken(rotated.accessToken)).toEqual({ userId: 1n });
  });

  it('theft-detection отзывает только family украденного токена, не сессии посторонних пользователей (updateMany обязан фильтровать по family)', async () => {
    const { svc, webSessions } = makeService();
    await svc.issueTokens(99n); // посторонний пользователь, своя family
    const issued = await svc.issueTokens(1n);
    // Цепочку надо ПРОДВИНУТЬ: кражей считается повтор, когда наследником уже
    // воспользовались. Одна ротация делает наследника, вторая — использует его.
    const second = await svc.rotateRefreshToken(issued.refreshToken);
    await svc.rotateRefreshToken(second.refreshToken);
    await expect(svc.rotateRefreshToken(issued.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    ); // reuse → theft-detection всей family
    const bystanderSession = webSessions.find((s) => s.userId === 99n);
    expect(bystanderSession?.revokedAt).toBeNull();
  });

  it('family отсутствует (falsy) у истёкшей/отозванной сессии → theft-detection блок не запускается (не палит securityLog на пустом family)', async () => {
    const { svc, webSessions, securityLog } = makeService();
    webSessions.push({
      id: 'no-family-session',
      userId: 1n,
      tokenHash: createHash('sha256').update('no-family-raw').digest('hex'),
      family: null, // без family — раньше выданные до фичи family, например
      expiresAt: new Date(FIXED_DATE.getTime() - 1000), // уже истёкла
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
    });
    await expect(svc.rotateRefreshToken('no-family-raw')).rejects.toThrow(
      'Refresh token already used or expired',
    );
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  it('expiresAt ровно равен текущему моменту (граница) → ещё НЕ истёк, ротация проходит успешно', async () => {
    const { svc, webSessions } = makeService();
    const issued = await svc.issueTokens(1n);
    webSessions[0].expiresAt = new Date(FIXED_DATE.getTime());
    await expect(svc.rotateRefreshToken(issued.refreshToken)).resolves.toEqual(
      expect.objectContaining({ refreshToken: expect.any(String) }),
    );
  });

  // Регрессия на разбор 2026-08-28 «постоянно выкидывает». Кражу от
  // потерянного ответа отличает НАСЛЕДНИК, а не время: пользовался ли токеном,
  // выданным взамен, кто-нибудь ещё.
  it('наследником воспользовались → повтор старого токена палит всю family (настоящая кража)', async () => {
    const { svc, webSessions, securityLog } = makeService();
    const issued = await svc.issueTokens(1n);
    const second = await svc.rotateRefreshToken(issued.refreshToken);
    // Легитимный клиент продолжил цепочку — значит наследник дошёл до него.
    await svc.rotateRefreshToken(second.refreshToken);

    await expect(svc.rotateRefreshToken(issued.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(webSessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(securityLog.log).toHaveBeenCalledWith(
      'refresh_token_reuse',
      expect.objectContaining({ userId: 1n }),
    );
  });

  it('ответ ротации не доехал — СПУСТЯ СУТКИ старый токен всё ещё впускает', async () => {
    const { svc, securityLog } = makeService();
    const issued = await svc.issueTokens(1n);
    // Ротация прошла на сервере, но Set-Cookie не доехал: ОС усыпила
    // приложение. У клиента остался ПРЕЖНИЙ токен.
    await svc.rotateRefreshToken(issued.refreshToken);

    // Человек возвращается на следующий день — раньше здесь его выкидывало и
    // отзывало все его сессии разом.
    jest.setSystemTime(new Date(FIXED_DATE.getTime() + 24 * 3600 * 1000));
    const recovered = await svc.rotateRefreshToken(issued.refreshToken);

    expect(recovered.accessToken).toBeTruthy();
    expect(recovered.rotated).toBe(true);
    expect(securityLog.log).not.toHaveBeenCalledWith(
      'refresh_token_reuse',
      expect.anything(),
    );
  });

  it('ответ не доехал ДВАЖДЫ подряд — вход всё равно не теряется', async () => {
    const { svc } = makeService();
    const issued = await svc.issueTokens(1n);
    await svc.rotateRefreshToken(issued.refreshToken);
    jest.setSystemTime(new Date(FIXED_DATE.getTime() + 3600_000));
    await svc.rotateRefreshToken(issued.refreshToken);
    jest.setSystemTime(new Date(FIXED_DATE.getTime() + 7200_000));

    // Без перенацеливания replacedByHash второй повтор выглядел бы кражей:
    // прежний наследник к этому моменту уже отозван восстановлением.
    await expect(svc.rotateRefreshToken(issued.refreshToken)).resolves.toEqual(
      expect.objectContaining({ rotated: true }),
    );
  });

  it('восстановление оставляет в семье ровно один живой токен', async () => {
    const { svc, webSessions } = makeService();
    const issued = await svc.issueTokens(1n);
    await svc.rotateRefreshToken(issued.refreshToken);
    jest.setSystemTime(new Date(FIXED_DATE.getTime() + 3600_000));
    await svc.rotateRefreshToken(issued.refreshToken);

    // Иначе детекция перестала бы что-либо значить: два живых токена в одной
    // цепочке — это ровно то состояние, которое она обязана ловить.
    expect(webSessions.filter((s) => s.revokedAt === null)).toHaveLength(1);
  });

  it.each<[string, (svc: AuthService) => Promise<string>]>([
    ['неизвестный (мусорный) токен', () => Promise.resolve('garbage-token')],
    [
      'истёкший',
      async (svc) => {
        const issued = await svc.issueTokens(1n);
        jest.setSystemTime(
          new Date(FIXED_DATE.getTime() + 31 * 24 * 3600 * 1000),
        );
        return issued.refreshToken;
      },
    ],
    [
      'явно отозванный (revokeSession)',
      async (svc) => {
        const issued = await svc.issueTokens(1n);
        await svc.revokeSession(issued.refreshToken);
        return issued.refreshToken;
      },
    ],
  ])('%s refresh-токен отклоняется', async (_name, setup) => {
    const { svc } = makeService();
    const token = await setup(svc);
    await expect(svc.rotateRefreshToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

// Пункт 2 диагностики 2026-08-21 «постоянно нужно логиниться заново»: каждая
// загрузка страницы дёргала refresh и ротировала куку — само по себе источник
// гонки reuse-детекции. shouldSkipRotation (refresh-rotation.ts) подавляет
// повторную ротацию одной сессии в пределах REFRESH_ROTATE_MIN_INTERVAL_MS.
describe('AuthService — rotateRefreshToken: интервал ротации', () => {
  it('ротировали только что (< 5 мин назад) → access новый, refresh ТОТ ЖЕ, кука не меняется', async () => {
    const { svc, webSessions } = makeService();
    const issued = await svc.issueTokens(1n);
    webSessions[0].createdAt = FIXED_DATE; // сессия только что создана/ротирована
    jest.setSystemTime(new Date(FIXED_DATE.getTime() + 60_000)); // +1 мин

    const result = await svc.rotateRefreshToken(issued.refreshToken);

    expect(result.rotated).toBe(false);
    expect(result.refreshToken).toBe(issued.refreshToken); // не поменялся
    expect(result.accessToken).not.toBe(''); // access всё равно свежий JWT
    expect(webSessions).toHaveLength(1); // новая строка НЕ создана
    expect(webSessions[0].revokedAt).toBeNull(); // старая НЕ отозвана
  });

  it('ротировали давно (≥ 5 мин назад) → обычная ротация, refresh новый', async () => {
    const { svc, webSessions } = makeService();
    const issued = await svc.issueTokens(1n);
    webSessions[0].createdAt = FIXED_DATE;
    jest.setSystemTime(new Date(FIXED_DATE.getTime() + 5 * 60_000)); // ровно 5 мин

    const result = await svc.rotateRefreshToken(issued.refreshToken);

    expect(result.rotated).toBe(true);
    expect(result.refreshToken).not.toBe(issued.refreshToken);
    expect(webSessions).toHaveLength(2);
    expect(webSessions[0].revokedAt).not.toBeNull(); // старая отозвана
  });

  it('createdAt отсутствует в строке сессии (fake-Prisma без @default) → всё равно ротирует (не падает)', async () => {
    const { svc, webSessions } = makeService();
    const issued = await svc.issueTokens(1n);
    expect(webSessions[0].createdAt).toBeUndefined(); // как и в проде до фикса
    const result = await svc.rotateRefreshToken(issued.refreshToken);
    expect(result.rotated).toBe(true);
  });
});

describe('AuthService — verifyTelegramWebAppData', () => {
  it('валидная подпись → id и firstName пользователя', () => {
    const { svc } = makeService();
    const initData = signInitData({ user: { id: 42, first_name: 'Грег' } });
    expect(svc.verifyTelegramWebAppData(initData)).toEqual({
      id: 42,
      firstName: 'Грег',
    });
  });

  it('нет hash → именно "Missing hash in initData" (не проваливается в другую ветку)', () => {
    const { svc } = makeService();
    const initData = signInitData({ user: { id: 1 }, hash: 'omit' });
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow(
      'Missing hash in initData',
    );
  });

  it('user отсутствует в initData целиком (не просто user.id) → UnauthorizedException, не TypeError', () => {
    // Без `user=` вообще (не путать с "user есть, но без id" — см. отдельный
    // тест ниже). JSON.parse(null) не бросает (парсит как "null"), поэтому
    // отличить это от штатного отказа можно только явной проверкой !userJson.
    const { svc } = makeService();
    const params = new URLSearchParams();
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));
    const checkString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const hash = createHmac('sha256', secret).update(checkString).digest('hex');
    params.set('hash', hash);
    expect(() => svc.verifyTelegramWebAppData(params.toString())).toThrow(
      UnauthorizedException,
    );
  });

  it.each<[string, () => string]>([
    [
      'hash не 64-hex (мусор)',
      () => signInitData({ user: { id: 1 }, hash: 'not-hex-and-wrong-length' }),
    ],
    [
      'подделанный (но правильной длины) hash',
      () => signInitData({ user: { id: 42 }, hash: 'a'.repeat(64) }),
    ],
    [
      'просроченный auth_date (старше часа)',
      () =>
        signInitData({
          user: { id: 42 },
          authDate: Math.floor(Date.now() / 1000) - 3700,
        }),
    ],
  ])('%s → UnauthorizedException', (_name, buildInitData) => {
    const { svc } = makeService();
    expect(() => svc.verifyTelegramWebAppData(buildInitData())).toThrow(
      UnauthorizedException,
    );
  });

  it('auth_date ровно на границе окна (now - 3600s) → принимается (не просрочен)', () => {
    const { svc } = makeService();
    const initData = signInitData({
      user: { id: 42 },
      authDate: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(svc.verifyTelegramWebAppData(initData)).toEqual({
      id: 42,
      firstName: '',
    });
  });

  it('hash с посторонним префиксом перед 64 hex-символами → "Malformed hash" (regex обязан быть заякорён с начала, не просто искать 64-hex где-то внутри)', () => {
    const { svc } = makeService();
    const initData = signInitData({
      user: { id: 1 },
      hash: 'zz' + 'a'.repeat(64),
    });
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow(
      'Malformed hash in initData',
    );
  });

  it('hash с посторонним суффиксом после 64 hex-символов → "Malformed hash" (regex обязан требовать конец строки, не просто префикс)', () => {
    const { svc } = makeService();
    const initData = signInitData({
      user: { id: 1 },
      hash: 'a'.repeat(64) + 'zz',
    });
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow(
      'Malformed hash in initData',
    );
  });

  it('BOT_TOKEN с пробелами/переносом строки по краям (случайность env) — verify обязан использовать .trim()', () => {
    const rawToken = ' 12345:TEST_TOKEN\n';
    const { svc } = makeService({ BOT_TOKEN: rawToken });
    // initData подписан так, как реально подписал бы Telegram — с
    // очищенным токеном (это и есть контракт .trim() внутри verify).
    const initData = signInitData({
      user: { id: 7 },
      botToken: rawToken.trim(),
    });
    expect(svc.verifyTelegramWebAppData(initData)).toEqual({
      id: 7,
      firstName: '',
    });
  });
});

describe('AuthService — findOrCreateUserByProvider', () => {
  it('существующий провайдер → возвращает его userId, новую User-строку не создаёт', async () => {
    const { svc, authProviders, users } = makeService();
    authProviders.push({
      id: 1,
      userId: 777n,
      provider: 'google',
      providerId: 'g-1',
      displayName: 'Old Name',
    });
    const userId = await svc.findOrCreateUserByProvider(
      'google',
      'g-1',
      'New Name',
    );
    expect(userId).toBe(777n);
    expect(authProviders[0].displayName).toBe('New Name');
    expect(users).toHaveLength(0);
  });

  it('существующий провайдер, displayName не передан → update НЕ вызывается, старое имя не затирается', async () => {
    const { svc, authProviders, prisma } = makeService();
    authProviders.push({
      id: 1,
      userId: 777n,
      provider: 'google',
      providerId: 'g-1',
      displayName: 'Old Name',
    });
    const userId = await svc.findOrCreateUserByProvider('google', 'g-1');
    expect(userId).toBe(777n);
    expect(authProviders[0].displayName).toBe('Old Name'); // не undefined
    expect(prisma.authProvider.update).not.toHaveBeenCalled();
  });

  it('несвязанная существующая пара (provider,providerId) не мешает найти НОВУЮ комбинацию — findUnique обязан фильтровать по where, а не брать первую строку таблицы', async () => {
    const { svc, authProviders, users } = makeService();
    authProviders.push({
      id: 1,
      userId: 42n,
      provider: 'google',
      providerId: 'g-unrelated',
      displayName: 'Другой человек',
    });
    const userId = await svc.findOrCreateUserByProvider('google', 'g-7', 'Имя');
    expect(userId).not.toBe(42n); // не спутали с чужой записью
    expect(users.some((u) => u.id === userId)).toBe(true);
    expect(authProviders).toHaveLength(2);
  });

  it('displayName-update при существующем провайдере обновляет ИМЕННО его запись, а не первую в таблице (update-where обязан матчить по id)', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push(
      { id: 1, userId: 1n, provider: 'google', providerId: 'g-first' },
      { id: 2, userId: 2n, provider: 'google', providerId: 'g-second' },
    );
    await svc.findOrCreateUserByProvider('google', 'g-second', 'НовоеИмя');
    expect(authProviders[0].displayName).toBeUndefined(); // соседняя не тронута
    expect(authProviders[1].displayName).toBe('НовоеИмя');
  });

  it('User.upsert(where:{id:userId}) для НОВОГО провайдера не должен матчить существующего ПОСТОРОННЕГО User — создаёт отдельную запись', async () => {
    const { svc, users } = makeService();
    users.push({ id: 999n, firstName: 'Посторонний' });
    const userId = await svc.findOrCreateUserByProvider(
      'google',
      'g-newuser',
      'Имя',
    );
    expect(userId).not.toBe(999n);
    expect(users).toHaveLength(2);
    expect(users.find((u) => u.id === 999n)?.firstName).toBe('Посторонний'); // не тронут
  });

  it('User уже существует (напр. telegram-юзер бота) с тем же id, что и generateWebUserId не совпадает, но telegram-провайдер повторно логинится → firstName обновляется через upsert.update, не молчаливо игнорируется', async () => {
    const { svc, users } = makeService();
    users.push({ id: 555n, firstName: 'СтароеИмяИзБота' });
    await svc.findOrCreateUserByProvider('telegram', '555', 'НовоеИмяТг');
    expect(users).toHaveLength(1); // не задублировал User
    expect(users[0].firstName).toBe('НовоеИмяТг'); // update.firstName реально применился
  });

  it('атомарный upsert AuthProvider (гонка) находит уже вставленную конкурентом строку именно по (provider,providerId), а не по первой строке таблицы', async () => {
    const { svc, prisma, authProviders } = makeService();
    authProviders.push(
      {
        id: 1,
        userId: 999n,
        provider: 'google',
        providerId: 'g-unrelated-race',
        displayName: 'Посторонний',
      },
      {
        id: 2,
        userId: 50n,
        provider: 'google',
        providerId: 'g-raced',
        displayName: 'Old',
      },
    );
    // Имитируем гонку: начальный findUnique "не увидел" конкурентную вставку
    // (case происходит между первым findUnique и atomic-upsert ниже), а сам
    // upsert (реальный Postgres INSERT … ON CONFLICT) её уже видит.
    (prisma.authProvider.findUnique as jest.Mock).mockImplementationOnce(
      () => null,
    );
    const userId = await svc.findOrCreateUserByProvider(
      'google',
      'g-raced',
      'NewDisplayName',
    );
    expect(userId).toBe(50n); // userId существующей (обновлённой) строки, не постороннего 999n
    expect(authProviders).toHaveLength(2); // не задублировал
    expect(authProviders[0].displayName).toBe('Посторонний'); // соседняя не тронута
    expect(authProviders[1].displayName).toBe('NewDisplayName');
  });

  it.each<['telegram' | 'google', string, (id: bigint) => void]>([
    ['telegram', '555', (id) => expect(id).toBe(555n)], // userId = telegramId
    [
      'google', // web-only userId в безопасном от Telegram-ID диапазоне
      'g-sub-1',
      (id) => {
        expect(id).toBeGreaterThanOrEqual(WEB_USER_ID_MIN);
        expect(id).toBeLessThan(WEB_USER_ID_MAX);
      },
    ],
  ])(
    'новый %s-провайдер (%s) создаёт User + AuthProvider',
    async (provider, providerId, assertId) => {
      const { svc, users, authProviders } = makeService();
      const userId = await svc.findOrCreateUserByProvider(
        provider,
        providerId,
        'Имя',
      );
      assertId(userId);
      expect(users[0].id).toBe(userId);
      expect(authProviders[0]).toEqual(
        expect.objectContaining({ userId, provider }),
      );
    },
  );

  it('generateWebUserId: id = MIN + rand % (MAX - MIN) — диапазон именно разность, а не сумма границ', async () => {
    const { svc } = makeService();
    // Фиксируем "случайные" 8 байт — весь диапазон unsigned 64 бит, чтобы
    // разность и сумма границ (мутант ArithmeticOperator) давали заведомо
    // разный результат по модулю. auth.service.ts делает `import * as crypto
    // from 'crypto'` — тот же закешированный модуль, что и require('crypto')
    // здесь, поэтому spyOn ловит и его вызов randomBytes(8).
    const fixedBytes = Buffer.from('ffffffffffffffff', 'hex');
    const mockedRandomBytes = cryptoModule.randomBytes as unknown as jest.Mock;
    // …Once — самовосстанавливающийся оверрайд ровно на 1 следующий вызов
    // (generateWebUserId дёргает randomBytes(8) ровно один раз), дефолтная
    // (реальная) реализация для остальных тестов файла не трогается.
    mockedRandomBytes.mockReturnValueOnce(fixedBytes);
    const userId = await svc.findOrCreateUserByProvider(
      'google',
      'g-arith-boundary',
      'Имя',
    );
    const rand = BigInt('0x' + fixedBytes.toString('hex'));
    const range = WEB_USER_ID_MAX - WEB_USER_ID_MIN; // корректная формула
    const expected = WEB_USER_ID_MIN + (rand % range);
    expect(userId).toBe(expected);
    expect(userId).toBeGreaterThanOrEqual(WEB_USER_ID_MIN);
    expect(userId).toBeLessThan(WEB_USER_ID_MAX);
  });
});

describe('AuthService — merge-токены', () => {
  it('buildMergeToken → verifyMergeToken: roundtrip возвращает исходные поля', () => {
    const { svc } = makeService();
    const token = svc.buildMergeToken(1n, 2n, 'google', 'g-1');
    expect(svc.verifyMergeToken(token)).toEqual({
      target: 1n,
      source: 2n,
      provider: 'google',
      providerId: 'g-1',
    });
  });

  it('verifyMergeToken отклоняет токен чужого вида (link вместо merge)', () => {
    const { svc } = makeService();
    const linkToken = svc.buildLinkToken(1n);
    expect(() => svc.verifyMergeToken(linkToken)).toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService — verifyTelegramWebAppData: битый user JSON', () => {
  it('user-поле — не валидный JSON → UnauthorizedException (не SyntaxError наружу)', () => {
    const { svc } = makeService();
    // signInitData сериализует user через JSON.stringify — здесь собираем
    // initData вручную, чтобы протащить синтаксически битый JSON в user=.
    const params = new URLSearchParams();
    params.set('user', '{not-valid-json');
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));
    const checkString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const hash = createHmac('sha256', secret).update(checkString).digest('hex');
    params.set('hash', hash);
    expect(() => svc.verifyTelegramWebAppData(params.toString())).toThrow(
      UnauthorizedException,
    );
  });

  it('user.id отсутствует → UnauthorizedException', () => {
    const { svc } = makeService();
    const initData = signInitData({ user: { first_name: 'Без id' } });
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService — requestEmailLogin', () => {
  it.each([
    ['без @', 'not-an-email'],
    ['без домена', 'a@b'],
    ['слишком длинный (>254)', 'a'.repeat(250) + '@b.co'],
    // regex обязан быть заякорён с начала ('^') — иначе "мусор перед
    // валидным адресом" проходит, т.к. .test() ищет совпадение где угодно.
    ['мусор перед адресом (нет ^ — пропустил бы)', ' xx@yy.com'],
    // regex обязан требовать конец строки ('$') — иначе "валидный адрес +
    // хвост" проходит как валидный префикс.
    ['мусор после адреса (нет $ — пропустил бы)', 'xx@yy.com trailing'],
  ])('невалидный email (%s) → BadRequestException', async (_name, email) => {
    const { svc } = makeService();
    await expect(svc.requestEmailLogin(email)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('email ровно 254 символа (граница <= 254) → валиден, не бросает', async () => {
    const { svc } = makeService();
    const email = 'a'.repeat(248) + '@bb.co'; // 248 + 6 = 254
    expect(email).toHaveLength(254);
    await expect(svc.requestEmailLogin(email)).resolves.toEqual({ ok: true });
  });

  it('валидный email → создаёт пользователя, emailToken и шлёт письмо со ссылкой', async () => {
    const { svc, users, emailTokens, emailSvc, authProviders } = makeService();
    const result = await svc.requestEmailLogin('User@Example.com');
    expect(result).toEqual({ ok: true });
    expect(users).toHaveLength(1);
    expect(emailTokens).toHaveLength(1);
    expect(emailTokens[0].purpose).toBe('login');
    // Провайдер обязан называться именно 'email' (не пустой строкой) —
    // от этого зависит и findOrCreateUserByProvider, и последующие лукапы.
    expect(authProviders[0].provider).toBe('email');
    // displayName = локальная часть до '@', не первый символ строки.
    expect(authProviders[0].displayName).toBe('user');
    expect(emailSvc.sendLoginLink).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('/api/auth/email/callback?token='),
      'ty',
    );
    // TTL магической ссылки — ровно 30 минут (EMAIL_TOKEN_TTL_MS), не 0.5мс
    // и не 1.8мс, как дала бы поломанная арифметика.
    expect(emailTokens[0].expiresAt.getTime()).toBe(
      FIXED_DATE.getTime() + 30 * 60 * 1000,
    );
  });

  it('WEBAPP_URL с trailing slash → ссылка без двойного слэша и без мусора вместо него', async () => {
    const { svc, emailSvc } = makeService({
      WEBAPP_URL: 'https://schemehappens.ru/',
    });
    await svc.requestEmailLogin('slash@example.com');
    const link = emailSvc.sendLoginLink.mock.calls[0][1] as string;
    expect(link).toMatch(
      /^https:\/\/schemehappens\.ru\/api\/auth\/email\/callback\?token=/,
    );
  });

  it('повторный запрос для того же email переиспользует существующего пользователя', async () => {
    const { svc, users } = makeService();
    await svc.requestEmailLogin('same@example.com');
    await svc.requestEmailLogin('same@example.com');
    expect(users).toHaveLength(1); // findOrCreateUserByProvider не плодит второго User
  });

  it('падение отправки письма не роняет запрос (fire-and-forget) — ok:true всё равно возвращается', async () => {
    const { svc, emailSvc } = makeService();
    emailSvc.sendLoginLink.mockRejectedValueOnce(new Error('smtp down'));
    await expect(svc.requestEmailLogin('fails@example.com')).resolves.toEqual({
      ok: true,
    });
  });

  it('падение отправки письма логируется через logger.error (.catch реально исполняется, не заглушен)', async () => {
    const { svc, emailSvc } = makeService();
    emailSvc.sendLoginLink.mockRejectedValueOnce(new Error('smtp down'));
    const errorSpy = jest.spyOn((svc as any).logger, 'error');
    await svc.requestEmailLogin('logfail@example.com');
    await Promise.resolve(); // дать микротаске .catch() отработать
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('sendLoginLink failed: smtp down'),
    );
  });

  it('encField вернул null (напр. сбой шифрования) → в БД сохраняется читаемый email как fallback, не null (?? а не &&)', async () => {
    const { svc, emailTokens } = makeService();
    (encrypt as jest.Mock).mockReturnValueOnce(null);
    await svc.requestEmailLogin('fallback@example.com');
    expect(emailTokens[0].email).toBe('fallback@example.com');
  });
});

describe('AuthService — linkEmailToAccount', () => {
  it('невалидный email → BadRequestException', async () => {
    const { svc } = makeService();
    await expect(svc.linkEmailToAccount(1n, 'nope')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('email уже привязан к ДРУГОМУ userId → ConflictException, письмо не шлётся', async () => {
    const { svc, authProviders, emailSvc } = makeService();
    authProviders.push({
      id: 1,
      userId: 111n,
      provider: 'email',
      providerId: 'busy@example.com',
    });
    await expect(
      svc.linkEmailToAccount(222n, 'busy@example.com'),
    ).rejects.toThrow(ConflictException);
    expect(emailSvc.sendLoginLink).not.toHaveBeenCalled();
  });

  it('email уже привязан к ТОМУ ЖЕ userId → не конфликт, письмо шлётся снова', async () => {
    const { svc, authProviders, emailSvc } = makeService();
    authProviders.push({
      id: 1,
      userId: 111n,
      provider: 'email',
      providerId: 'own@example.com',
    });
    await expect(
      svc.linkEmailToAccount(111n, 'own@example.com'),
    ).resolves.toEqual({ ok: true });
    expect(emailSvc.sendLoginLink).toHaveBeenCalled();
  });

  it('несвязанная существующая запись не даёт ложный конфликт — where обязан фильтровать по email, а не брать первую строку', async () => {
    const { svc, authProviders, emailSvc } = makeService();
    authProviders.push({
      id: 1,
      userId: 999n,
      provider: 'email',
      providerId: 'someone-else@example.com',
    });
    await expect(
      svc.linkEmailToAccount(555n, 'brandnew@example.com'),
    ).resolves.toEqual({ ok: true });
    expect(emailSvc.sendLoginLink).toHaveBeenCalled();
  });

  it('WEBAPP_URL с trailing slash → ссылка без двойного слэша и без мусора вместо него', async () => {
    const { svc, emailSvc } = makeService({
      WEBAPP_URL: 'https://schemehappens.ru/',
    });
    await svc.linkEmailToAccount(1n, 'link-slash@example.com');
    const link = emailSvc.sendLoginLink.mock.calls[0][1] as string;
    expect(link).toMatch(
      /^https:\/\/schemehappens\.ru\/api\/auth\/email\/callback\?token=/,
    );
  });

  it('encField вернул null → в БД сохраняется читаемый email как fallback, не null (?? а не &&)', async () => {
    const { svc, emailTokens } = makeService();
    (encrypt as jest.Mock).mockReturnValueOnce(null);
    await svc.linkEmailToAccount(1n, 'link-fallback@example.com');
    expect(emailTokens[0].email).toBe('link-fallback@example.com');
  });

  it('падение отправки письма логируется через logger.error (.catch реально исполняется)', async () => {
    const { svc, emailSvc } = makeService();
    emailSvc.sendLoginLink.mockRejectedValueOnce(new Error('smtp down'));
    const errorSpy = jest.spyOn((svc as any).logger, 'error');
    await svc.linkEmailToAccount(1n, 'link-logfail@example.com');
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'linkEmailToAccount sendLoginLink failed: smtp down',
      ),
    );
  });
});

describe('AuthService — linkProviderToUser', () => {
  it('провайдер уже привязан к этому же userId → ok:true, ничего не создаёт', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 5n,
      provider: 'google',
      providerId: 'g-5',
    });
    const result = await svc.linkProviderToUser(5n, 'google', 'g-5');
    expect(result).toEqual({ ok: true });
    expect(authProviders).toHaveLength(1);
  });

  it('провайдер привязан к ДРУГОМУ userId → ok:false с conflictUserId', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 5n,
      provider: 'google',
      providerId: 'g-5',
    });
    const result = await svc.linkProviderToUser(6n, 'google', 'g-5');
    expect(result).toEqual({ ok: false, conflictUserId: '5' });
  });

  it('новый провайдер → создаёт AuthProvider, логирует, ok:true', async () => {
    const { svc, authProviders } = makeService();
    const result = await svc.linkProviderToUser(7n, 'google', 'g-7', 'Имя');
    expect(result).toEqual({ ok: true });
    expect(authProviders[0]).toEqual(
      expect.objectContaining({ userId: 7n, provider: 'google' }),
    );
  });

  it('несвязанная существующая запись не должна считаться совпадением — findUnique обязан фильтровать по (provider, providerId), а не брать первую строку', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 42n,
      provider: 'google',
      providerId: 'g-unrelated',
    });
    const result = await svc.linkProviderToUser(20n, 'google', 'g-new');
    expect(result).toEqual({ ok: true }); // не ok:false с чужим conflictUserId
    expect(authProviders).toHaveLength(2);
  });

  it('гонка (P2002) при create: конкурент вставил ту же пару → повторный findUnique возвращает тот же userId → ok:true', async () => {
    const { svc, prisma, authProviders } = makeService();
    const conflictErr = Object.assign(new Error('unique violation'), {
      code: 'P2002',
    });
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      // Имитируем гонку: конкурентный запрос успел вставить строку раньше нас.
      authProviders.push({
        id: 99,
        userId: 8n,
        provider: 'google',
        providerId: 'g-race',
      });
      throw conflictErr;
    });
    const result = await svc.linkProviderToUser(8n, 'google', 'g-race');
    expect(result).toEqual({ ok: true });
  });

  it('гонка (P2002), но конкурент привязал другого userId → ok:false с его conflictUserId', async () => {
    const { svc, prisma, authProviders } = makeService();
    const conflictErr = Object.assign(new Error('unique violation'), {
      code: 'P2002',
    });
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      authProviders.push({
        id: 99,
        userId: 8n,
        provider: 'google',
        providerId: 'g-race2',
      });
      throw conflictErr;
    });
    const result = await svc.linkProviderToUser(9n, 'google', 'g-race2');
    expect(result).toEqual({ ok: false, conflictUserId: '8' });
  });

  it('ошибка create без кода P2002 пробрасывается наружу как есть', async () => {
    const { svc, prisma } = makeService();
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      throw new Error('db exploded');
    });
    await expect(
      svc.linkProviderToUser(10n, 'google', 'g-boom'),
    ).rejects.toThrow('db exploded');
  });

  it('P2002 при create: несвязанная существующая запись не должна маскировать реального конкурента — повторный findUnique обязан искать именно по (provider,providerId)', async () => {
    const { svc, prisma, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 777n,
      provider: 'google',
      providerId: 'g-unrelated3',
    });
    const conflictErr = Object.assign(new Error('unique violation'), {
      code: 'P2002',
    });
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      authProviders.push({
        id: 99,
        userId: 8n,
        provider: 'google',
        providerId: 'g-race3',
      });
      throw conflictErr;
    });
    const result = await svc.linkProviderToUser(8n, 'google', 'g-race3');
    expect(result).toEqual({ ok: true }); // не спутали с посторонним userId 777n
  });

  it('P2002 при create, но повторный findUnique НИЧЕГО не находит (фантомная гонка) → пробрасывается исходная P2002-ошибка, а не падение на null.userId', async () => {
    const { svc, prisma } = makeService();
    const conflictErr = Object.assign(new Error('unique violation'), {
      code: 'P2002',
    });
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      // Никого не вставляем — P2002 без реально существующей строки
      // (напр. стёрли конкурентом между create и повторным findUnique).
      throw conflictErr;
    });
    await expect(
      svc.linkProviderToUser(11n, 'google', 'g-phantom'),
    ).rejects.toThrow('unique violation');
  });
});

describe('AuthService — unlinkProvider / getUserProviders', () => {
  it('unlinkProvider: единственный метод входа → ConflictException, ничего не удаляется', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 1n,
      provider: 'telegram',
      providerId: '1',
    });
    await expect(svc.unlinkProvider(1n, 'telegram')).rejects.toThrow(
      ConflictException,
    );
    expect(authProviders).toHaveLength(1);
  });

  it('unlinkProvider: подсчёт "единственный ли метод входа" обязан фильтровать по userId — чужие провайдеры в таблице не должны разрешить отвязку последнего своего', async () => {
    const { svc, authProviders } = makeService();
    // У ДРУГОГО пользователя — много провайдеров, у ЭТОГО — только один.
    authProviders.push(
      { id: 1, userId: 1n, provider: 'telegram', providerId: '1' },
      { id: 2, userId: 2n, provider: 'google', providerId: 'g-2' },
      { id: 3, userId: 2n, provider: 'email', providerId: 'x@y.z' },
    );
    await expect(svc.unlinkProvider(1n, 'telegram')).rejects.toThrow(
      ConflictException,
    );
    expect(authProviders).toHaveLength(3); // ничего не удалено
  });

  it('unlinkProvider: есть второй метод входа → отвязывает указанный провайдер', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push(
      { id: 1, userId: 1n, provider: 'telegram', providerId: '1' },
      { id: 2, userId: 1n, provider: 'google', providerId: 'g-1' },
    );
    await svc.unlinkProvider(1n, 'google');
    expect(authProviders).toHaveLength(1);
    expect(authProviders[0].provider).toBe('telegram');
  });

  it('getUserProviders возвращает провайдеры только запрошенного userId', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push(
      {
        id: 1,
        userId: 1n,
        provider: 'telegram',
        providerId: '1',
        email: null,
        displayName: 'Грег',
      },
      {
        id: 2,
        userId: 2n,
        provider: 'google',
        providerId: 'g-2',
        email: 'x@y.z',
        displayName: 'Другой',
      },
    );
    const rows = await svc.getUserProviders(1n);
    expect(rows).toEqual([
      { provider: 'telegram', email: null, displayName: 'Грег' },
    ]);
  });
});

describe('AuthService — 2FA challenge токены', () => {
  it('buildTotpChallengeToken → verifyTotpChallengeToken: roundtrip с ip/userAgent', () => {
    const { svc } = makeService();
    const token = svc.buildTotpChallengeToken(1n, '1.2.3.4', 'Mozilla/5.0');
    const decoded = svc.verifyTotpChallengeToken(token);
    expect(decoded.userId).toBe(1n);
    expect(decoded.ip).toBe('1.2.3.4');
    expect(decoded.ua).toBe('Mozilla/5.0');
  });

  it('buildTotpChallengeToken без ip/userAgent → ip null, ua пустая строка', () => {
    const { svc } = makeService();
    const token = svc.buildTotpChallengeToken(1n);
    const decoded = svc.verifyTotpChallengeToken(token);
    expect(decoded.ip).toBeNull();
    expect(decoded.ua).toBe('');
  });

  it('userAgent длиннее 120 символов обрезается до 120 (.slice(0, 120), не хранится целиком)', () => {
    const { svc } = makeService();
    const longUa = 'Mozilla/5.0 ' + 'x'.repeat(200); // 212 символов
    const token = svc.buildTotpChallengeToken(1n, '1.2.3.4', longUa);
    const decoded = svc.verifyTotpChallengeToken(token);
    expect(decoded.ua).toHaveLength(120);
    expect(decoded.ua).toBe(longUa.slice(0, 120));
  });
});

describe('AuthService — verifyLinkToken: невалидные токены', () => {
  it('мусорный токен → UnauthorizedException("Invalid or expired link token")', () => {
    const { svc } = makeService();
    expect(() => svc.verifyLinkToken('garbage')).toThrow(
      'Invalid or expired link token',
    );
  });

  it('buildLinkToken → verifyLinkToken: roundtrip возвращает исходный userId (ловит порчу type:"link" в payload и ключа JWT_SECRET)', () => {
    const { svc } = makeService();
    const token = svc.buildLinkToken(123n);
    expect(svc.verifyLinkToken(token)).toEqual({ userId: 123n });
  });
});

describe('AuthService — issueTokens/rotateRefreshToken: accessToken реально проходит verifyAccessToken', () => {
  it('issueTokens: выданный accessToken проходит verifyAccessToken с тем же userId (ловит порчу type:"access" и ключа JWT_SECRET)', async () => {
    const { svc } = makeService();
    const tokens = await svc.issueTokens(42n);
    expect(svc.verifyAccessToken(tokens.accessToken)).toEqual({
      userId: 42n,
    });
  });

  it('rotateRefreshToken: новый accessToken тоже проходит verifyAccessToken', async () => {
    const { svc } = makeService();
    const issued = await svc.issueTokens(42n);
    const rotated = await svc.rotateRefreshToken(issued.refreshToken);
    expect(svc.verifyAccessToken(rotated.accessToken)).toEqual({
      userId: 42n,
    });
  });
});

describe('AuthService — revokeSession: изоляция по конкретной сессии', () => {
  it('отзывает ровно свою сессию — чужая (другого userId) сессия не задета (updateMany обязан фильтровать по tokenHash, а не отзывать всё подряд)', async () => {
    const { svc, webSessions } = makeService();
    const userA = await svc.issueTokens(1n);
    await svc.issueTokens(2n);
    await svc.revokeSession(userA.refreshToken);
    const sessionA = webSessions.find((s) => s.userId === 1n);
    const sessionB = webSessions.find((s) => s.userId === 2n);
    expect(sessionA?.revokedAt).not.toBeNull();
    expect(sessionB?.revokedAt).toBeNull();
  });
});

describe('AuthService — revokeAllSessions', () => {
  it('отзывает все активные сессии пользователя, чужие не трогает', async () => {
    const { svc, webSessions } = makeService();
    await svc.issueTokens(1n);
    await svc.issueTokens(1n);
    await svc.issueTokens(2n);
    await svc.revokeAllSessions(1n);
    const forUser1 = webSessions.filter((s) => s.userId === 1n);
    const forUser2 = webSessions.filter((s) => s.userId === 2n);
    expect(forUser1.every((s) => s.revokedAt !== null)).toBe(true);
    expect(forUser2.every((s) => s.revokedAt === null)).toBe(true);
  });
});
