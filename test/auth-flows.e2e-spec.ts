// e2e SMOKE — auth.controller.ts: cookie/CSRF, refresh rotation + reuse
// (theft/race) detection, logout, 2FA gate — REAL AppModule/HTTP stack.
// telegram/webapp is throttled, so most cases seed a WebSession row directly.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { SecurityLogService } from '../src/auth/security-log.service';

const hashToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');

const hmacHex = (key: crypto.BinaryLike, data: string): string =>
  crypto.createHmac('sha256', key).update(data).digest('hex');

// Reimplements verifyTelegramWebAppData's HMAC (this route skips 2FA, see BUG below).
function buildTelegramInitData(id: number, botToken: string): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id, first_name: 'E2E' }));
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  params.set('hash', hmacHex(secretKey, checkString));
  return params.toString();
}

// Reimplements verifyClientData's HMAC (Login Widget, different secret) —
// this route runs signInOrLinkOrMerge, which checks totp.isEnabled().
function buildTelegramWidgetPayload(
  id: number,
  botToken: string,
): Record<string, string> {
  const fields: Record<string, string> = {
    id: String(id),
    first_name: 'E2E',
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  return { ...fields, hash: hmacHex(secretKey, checkString) };
}

function extractSetCookie(
  res: request.Response,
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

function extractCookieValue(
  res: request.Response,
  name: string,
): string | undefined {
  return extractSetCookie(res, name)
    ?.split(';')[0]
    .slice(name.length + 1);
}

describe('e2e smoke: auth-flows (cookie/CSRF/refresh/logout/2FA)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  let securityLog: SecurityLogService;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    securityLog = app.get(SecurityLogService);
  });

  afterAll(async () => {
    await app.close();
  });

  const botToken = () => process.env.BOT_TOKEN as string;

  const loginViaTelegramWebapp = (telegramId: number) =>
    request(app.getHttpServer())
      .post('/api/auth/telegram/webapp')
      .send({ initData: buildTelegramInitData(telegramId, botToken()) });

  const loginViaWidget = (telegramId: number) =>
    request(app.getHttpServer())
      .post('/api/auth/telegram/widget')
      .set('x-requested-with', 'XMLHttpRequest')
      .send(buildTelegramWidgetPayload(telegramId, botToken()));

  // Seeds a WebSession row like AuthService.issueTokens would (skips the throttle).
  function seedSession(
    userId: bigint,
    rawToken: string,
    opts: Partial<{ family: string; revokedAt: Date | null }> = {},
  ) {
    return prisma.webSession.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash: hashToken(rawToken),
        family: opts.family ?? crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        revokedAt: opts.revokedAt ?? null,
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    });
  }

  function refresh(cookieValue?: string, csrf = true) {
    const req = request(app.getHttpServer()).post('/api/auth/refresh');
    if (cookieValue) req.set('Cookie', `refresh_token=${cookieValue}`);
    if (csrf) req.set('x-requested-with', 'XMLHttpRequest');
    return req;
  }

  // Общий хелпер вместо повтора .set('x-requested-with', ...) на каждом POST.
  const post = (url: string) =>
    request(app.getHttpServer())
      .post(url)
      .set('x-requested-with', 'XMLHttpRequest');

  const sessionFor = (rawToken: string): any =>
    prisma.webSession._rows.find(
      (r: any) => r.tokenHash === hashToken(rawToken),
    );

  describe('refresh via httpOnly cookie', () => {
    it('login sets refresh_token with httpOnly/secure/sameSite=strict/path=/api/auth', async () => {
      const res = await loginViaTelegramWebapp(910_001);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      const cookie = extractSetCookie(res, 'refresh_token');
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth/i);
    });

    it('rotates the cookie', async () => {
      expect((await refresh(undefined)).status).toBe(401); // no cookie at all
      const raw = 'seed-refresh-rotate';
      seedSession(910_101n, raw);
      const res = await refresh(raw);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      const rotated = extractCookieValue(res, 'refresh_token');
      expect(rotated).toBeDefined();
      expect(rotated).not.toBe(raw);
    });

    // Разбор 2026-08-28 «постоянно выкидывает»: кражу от потерянного ответа
    // отличает НАСЛЕДНИК, а не время. Оба исхода — по отдельности, через
    // настоящий HTTP-стек с куками.
    it('наследником воспользовались → повтор старого токена палит всю family', async () => {
      const raw = 'seed-refresh-rotate-theft';
      seedSession(910_102n, raw);
      const rotated = extractCookieValue(await refresh(raw), 'refresh_token');
      // Легитимный клиент продолжил цепочку — наследник до него дошёл.
      const third = extractCookieValue(await refresh(rotated), 'refresh_token');

      expect((await refresh(raw)).status).toBe(401);
      expect((await refresh(third)).status).toBe(401); // family-wide
    });

    it('ответ ротации не доехал → старый токен впускает, а не выкидывает', async () => {
      const raw = 'seed-refresh-rotate-lost';
      seedSession(910_103n, raw);
      // Ротация прошла на сервере, но Set-Cookie не доехал до клиента.
      await refresh(raw);

      // Клиент возвращается с ПРЕЖНЕЙ кукой. Раньше здесь было 401 и отзыв
      // всех сессий человека разом.
      const recovered = await refresh(raw);
      expect(recovered.status).toBe(200);
      expect(recovered.body.accessToken).toEqual(expect.any(String));
      const reissued = extractCookieValue(recovered, 'refresh_token');
      expect(reissued).toBeDefined();
      expect(reissued).not.toBe(raw);
      // И выданная взамен кука сразу рабочая.
      expect((await refresh(reissued)).status).toBe(200);
    });
  });

  describe('logout', () => {
    it('clears the cookie and revokes the session in the DB', async () => {
      const raw = 'seed-refresh-logout';
      seedSession(910_201n, raw);
      const res = await post('/api/auth/logout').set(
        'Cookie',
        `refresh_token=${raw}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(extractSetCookie(res, 'refresh_token')).toMatch(/refresh_token=;/);
      expect(sessionFor(raw).revokedAt).not.toBeNull();
    });
  });

  describe('CSRF protection (x-requested-with, or JSON content-type as fallback)', () => {
    it('blocks refresh/logout without a CSRF signal; JSON content-type alone satisfies it', async () => {
      const raw1 = 'seed-refresh-csrf-blocked';
      seedSession(910_301n, raw1);
      const spy = jest.spyOn(securityLog, 'log');
      const blocked = await refresh(raw1, /* csrf */ false);
      expect(blocked.status).toBe(401);
      expect(blocked.body.message).toMatch(/CSRF/i);
      expect(spy).toHaveBeenCalledWith(
        'csrf_blocked',
        expect.objectContaining({ endpoint: 'refresh' }),
      );
      spy.mockRestore();
      expect(sessionFor(raw1).revokedAt).toBeNull(); // never touched AuthService
      const raw2 = 'seed-refresh-csrf-json';
      seedSession(910_302n, raw2);
      // .send({}) sets Content-Type: application/json — satisfies CSRF alone.
      const jsonOk = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${raw2}`)
        .send({});
      expect(jsonOk.status).toBe(200);
      const raw3 = 'seed-refresh-logout-csrf';
      seedSession(910_303n, raw3);
      const noCsrf = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${raw3}`);
      expect(noCsrf.status).toBe(401);
      expect(sessionFor(raw3).revokedAt).toBeNull();
    });
  });

  describe('2FA challenge path', () => {
    it('enabling TOTP gates login behind a challenge; wrong code rejected, right code issues tokens', async () => {
      const login = await loginViaWidget(910_401);
      const accessToken = login.body.accessToken;
      const auth = `Bearer ${accessToken}`;
      const setup = await post('/api/auth/2fa/setup').set(
        'Authorization',
        auth,
      );
      expect(setup.status).toBe(200);
      const secret = new URL(setup.body.otpauthUrl).searchParams.get(
        'secret',
      ) as string;
      const enable = await post('/api/auth/2fa/enable')
        .set('Authorization', auth)
        .send({ code: authenticator.generate(secret) });
      expect(enable.status).toBe(200);
      expect(enable.body.recoveryCodes).toHaveLength(10);
      // A fresh login (same widget route) now returns a challenge, not tokens.
      const login2 = await loginViaWidget(910_401);
      expect(login2.status).toBe(200);
      expect(login2.body.totp).toBe(true);
      expect(login2.body.accessToken).toBeUndefined();
      const challengeToken = login2.body.challengeToken;
      const wrongCode = await post('/api/auth/2fa/challenge').send({
        challengeToken,
        code: '000000',
      });
      expect(wrongCode.status).toBe(401);
      const rightCode = await post('/api/auth/2fa/challenge').send({
        challengeToken,
        code: authenticator.generate(secret),
      });
      expect(rightCode.status).toBe(200);
      expect(rightCode.body.accessToken).toEqual(expect.any(String));
    });

    // FINDING: telegram/webapp skips signInOrLinkOrMerge/totp.isEnabled() —
    // 2FA-enabled user still gets a full session (out of scope here).
    it('BUG: telegram/webapp login bypasses the 2FA gate entirely for the same user', async () => {
      const bypass = await loginViaTelegramWebapp(910_401);
      expect(bypass.status).toBe(200);
      expect(bypass.body.accessToken).toEqual(expect.any(String));
      expect(bypass.body.totp).toBeUndefined();
    });
  });

  // B-14 + B-16 (аудит 2026-10): ссылка из письма — двухшаговая. GET только
  // перенаправляет (сканер почты токен не сожжёт и сессию не украдёт), гасит
  // POST email/consume со страницы сайта; аккаунт заводится при погашении.
  describe('email magic-link: GET → страница → POST consume', () => {
    const seedLoginToken = (raw: string, userId: bigint | null = null) =>
      prisma.emailToken.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          tokenHash: hashToken(raw),
          email: 'e2e-new@example.com',
          purpose: 'login',
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
    const tokenRow = (raw: string): any =>
      prisma.emailToken._rows.find((r: any) => r.tokenHash === hashToken(raw));

    it('запрос ссылки для нового адреса НЕ создаёт ни User, ни AuthProvider', async () => {
      const usersBefore = prisma.user._rows.length;
      const providersBefore = prisma.authProvider._rows.length;
      const res = await post('/api/auth/email/link').send({
        email: 'e2e-squat@example.com',
      });
      expect(res.status).toBe(200);
      expect(prisma.user._rows).toHaveLength(usersBefore);
      expect(prisma.authProvider._rows).toHaveLength(providersBefore);
      expect(prisma.emailToken._rows.some((r: any) => r.userId === null)).toBe(
        true,
      );
    });

    it('GET callback → 302 на страницу сайта; токен НЕ погашен, кука НЕ выдана', async () => {
      await seedLoginToken('e2e-raw-token-1');
      const res = await request(app.getHttpServer())
        .get('/api/auth/email/callback?token=e2e-raw-token-1')
        .redirects(0);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(
        '/auth/callback?email_token=e2e-raw-token-1',
      );
      expect(extractSetCookie(res, 'refresh_token')).toBeUndefined();
      expect(tokenRow('e2e-raw-token-1').usedAt ?? null).toBeNull();
    });

    it('POST consume: токены + кука, аккаунт создан при погашении; повтор → 401', async () => {
      await seedLoginToken('e2e-raw-token-2');
      const usersBefore = prisma.user._rows.length;
      const res = await post('/api/auth/email/consume').send({
        token: 'e2e-raw-token-2',
      });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(extractSetCookie(res, 'refresh_token')).toBeDefined();
      expect(prisma.user._rows).toHaveLength(usersBefore + 1);
      expect(
        prisma.authProvider._rows.some(
          (r: any) =>
            r.provider === 'email' && r.providerId === 'e2e-new@example.com',
        ),
      ).toBe(true);

      const again = await post('/api/auth/email/consume').send({
        token: 'e2e-raw-token-2',
      });
      expect(again.status).toBe(401);
      expect(prisma.user._rows).toHaveLength(usersBefore + 1);
    });

    it('POST consume без токена / с не-строкой → 400 (TokenBodyDto)', async () => {
      expect((await post('/api/auth/email/consume').send({})).status).toBe(400);
      expect(
        (await post('/api/auth/email/consume').send({ token: 123 })).status,
      ).toBe(400);
    });
  });

  describe('Google One Tap nonce (B-16)', () => {
    it('GET nonce → кука gsi_nonce (httpOnly) + хеш секрета в теле, без кэша', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/auth/google/one-tap/nonce',
      );
      expect(res.status).toBe(200);
      const cookie = extractSetCookie(res, 'gsi_nonce')!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      const secret = extractCookieValue(res, 'gsi_nonce')!;
      expect(res.body.nonce).toBe(hashToken(secret));
      expect(res.headers['cache-control']).toContain('no-store');
    });
  });

  describe('malformed bodies → 400, not 500', () => {
    // Neither route uses a DTO (manual `@Body('x')` guards) — empty body → 400.
    it.each([['/api/auth/email/link'], ['/api/auth/merge']])(
      'POST %s with an empty body → 400',
      async (url) => {
        expect((await post(url).send({})).status).toBe(400);
      },
    );

    it('2fa/enable: missing code → 400, numeric code → 400 (TwoFaCodeDto, not 500)', async () => {
      const login = await loginViaTelegramWebapp(910_501);
      const auth = `Bearer ${login.body.accessToken}`;
      const enable = () =>
        post('/api/auth/2fa/enable').set('Authorization', auth);
      expect((await enable().send({})).status).toBe(400);
      const setup = await post('/api/auth/2fa/setup').set(
        'Authorization',
        auth,
      );
      expect(setup.status).toBe(200);
      // Regression: numeric `code` sailed past `if (!code)`, crashed
      // confirmSetup()'s `code.trim()` as 500 — DTO now rejects it as 400.
      expect((await enable().send({ code: 123456 })).status).toBe(400);
    });
  });
});
