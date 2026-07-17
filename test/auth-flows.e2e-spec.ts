// e2e SMOKE — auth.controller.ts (1171 lines, largest untested file):
// cookie/CSRF, refresh rotation + reuse (theft) detection, logout, and the
// 2FA gate, through the REAL AppModule/HTTP stack (build-test-app.ts, same
// as app-auth/app-ownership). telegram/webapp is tightly throttled (5/60s),
// so most refresh/logout/CSRF cases seed a WebSession row directly into
// fake-prisma (mirrors AuthService.issueTokens) instead of a real login.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { SecurityLogService } from '../src/auth/security-log.service';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function hmacHex(key: crypto.BinaryLike, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

// Reimplements AuthService.verifyTelegramWebAppData's HMAC — drives a real
// mini-app login. NOTE: this route skips the 2FA gate (see BUG test below).
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

// Reimplements TelegramProvider.verifyClientData's HMAC (Login Widget format,
// different secret than the WebApp one). This route runs signInOrLinkOrMerge
// — the path that actually checks totp.isEnabled().
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

  function loginViaTelegramWebapp(telegramId: number) {
    return request(app.getHttpServer())
      .post('/api/auth/telegram/webapp')
      .send({ initData: buildTelegramInitData(telegramId, botToken()) });
  }

  function loginViaWidget(telegramId: number) {
    return request(app.getHttpServer())
      .post('/api/auth/telegram/widget')
      .set('x-requested-with', 'XMLHttpRequest')
      .send(buildTelegramWidgetPayload(telegramId, botToken()));
  }

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

  function sessionFor(rawToken: string): any {
    return prisma.webSession._rows.find(
      (r: any) => r.tokenHash === hashToken(rawToken),
    );
  }

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

    it('rotates the cookie; reusing the old one is rejected and revokes the whole family (theft)', async () => {
      expect((await refresh(undefined)).status).toBe(401); // no cookie at all
      const raw = 'seed-refresh-rotate';
      seedSession(910_101n, raw);
      const res = await refresh(raw);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      const rotated = extractCookieValue(res, 'refresh_token');
      expect(rotated).toBeDefined();
      expect(rotated).not.toBe(raw);
      const reuse = await refresh(raw); // old token, already marked used
      expect(reuse.status).toBe(401);
      // Family-wide revocation — even the freshly rotated token is dead now.
      expect((await refresh(rotated)).status).toBe(401);
    });
  });

  describe('logout', () => {
    it('clears the cookie and revokes the session in the DB', async () => {
      const raw = 'seed-refresh-logout';
      seedSession(910_201n, raw);
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${raw}`)
        .set('x-requested-with', 'XMLHttpRequest');
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
      const jsonOk = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${raw2}`)
        .send({}); // supertest sets Content-Type: application/json, no x-requested-with
      expect(jsonOk.status).toBe(200);
      const raw3 = 'seed-refresh-logout-csrf';
      seedSession(910_303n, raw3);
      const logoutBlocked = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${raw3}`);
      expect(logoutBlocked.status).toBe(401);
      expect(sessionFor(raw3).revokedAt).toBeNull();
    });
  });

  describe('2FA challenge path', () => {
    it('enabling TOTP gates login behind a challenge; wrong code rejected, right code issues tokens', async () => {
      const login = await loginViaWidget(910_401);
      const accessToken = login.body.accessToken;
      const setup = await request(app.getHttpServer())
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-requested-with', 'XMLHttpRequest');
      expect(setup.status).toBe(200);
      const secret = new URL(setup.body.otpauthUrl).searchParams.get(
        'secret',
      ) as string;
      const enable = await request(app.getHttpServer())
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-requested-with', 'XMLHttpRequest')
        .send({ code: authenticator.generate(secret) });
      expect(enable.status).toBe(200);
      expect(enable.body.recoveryCodes).toHaveLength(10);
      // A fresh login (same widget route) now returns a challenge, not tokens.
      const login2 = await loginViaWidget(910_401);
      expect(login2.status).toBe(200);
      expect(login2.body.totp).toBe(true);
      expect(login2.body.accessToken).toBeUndefined();
      const challengeToken = login2.body.challengeToken;
      const wrongCode = await request(app.getHttpServer())
        .post('/api/auth/2fa/challenge')
        .set('x-requested-with', 'XMLHttpRequest')
        .send({ challengeToken, code: '000000' });
      expect(wrongCode.status).toBe(401);
      const rightCode = await request(app.getHttpServer())
        .post('/api/auth/2fa/challenge')
        .set('x-requested-with', 'XMLHttpRequest')
        .send({ challengeToken, code: authenticator.generate(secret) });
      expect(rightCode.status).toBe(200);
      expect(rightCode.body.accessToken).toEqual(expect.any(String));
    });

    // FINDING: telegram/webapp (mini-app initData auto-login) skips
    // signInOrLinkOrMerge — never calls totp.isEnabled() — so a user with
    // 2FA enabled above still gets a full session with no TOTP prompt.
    // Not fixed here (production src is out of scope for this task).
    it('BUG: telegram/webapp login bypasses the 2FA gate entirely for the same user', async () => {
      const bypass = await loginViaTelegramWebapp(910_401);
      expect(bypass.status).toBe(200);
      expect(bypass.body.accessToken).toEqual(expect.any(String));
      expect(bypass.body.totp).toBeUndefined();
    });
  });

  describe('malformed bodies → 400, not 500', () => {
    // Neither route uses a DTO (manual `@Body('x')` guards) — empty body → 400.
    it.each([['/api/auth/email/link'], ['/api/auth/merge']])(
      'POST %s with an empty body → 400',
      async (url) => {
        const res = await request(app.getHttpServer())
          .post(url)
          .set('x-requested-with', 'XMLHttpRequest')
          .send({});
        expect(res.status).toBe(400);
      },
    );

    it('2fa/enable: missing code → 400, numeric code → 400 (TwoFaCodeDto, not 500)', async () => {
      const login = await loginViaTelegramWebapp(910_501);
      const token = login.body.accessToken;
      const auth = (r: request.Test) =>
        r.set('Authorization', `Bearer ${token}`).set('x-requested-with', 'x');
      const missing = await auth(
        request(app.getHttpServer()).post('/api/auth/2fa/enable'),
      ).send({});
      expect(missing.status).toBe(400);
      const setup = await auth(
        request(app.getHttpServer()).post('/api/auth/2fa/setup'),
      );
      expect(setup.status).toBe(200);
      // Regression: a numeric `code` used to sail past `if (!code)` then
      // crash confirmSetup()'s `code.trim()` as a 500. TwoFaCodeDto
      // (src/auth/dto/twofa.dto.ts) now rejects it as a clean 400.
      const numeric = await auth(
        request(app.getHttpServer()).post('/api/auth/2fa/enable'),
      ).send({ code: 123456 });
      expect(numeric.status).toBe(400);
    });
  });
});
