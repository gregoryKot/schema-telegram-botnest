import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import { EmailService } from './email.service';

// auth.controller → providers/registry → google.provider → jose (ESM). Мокаем.
jest.mock('jose', () => ({ createRemoteJWKSet: jest.fn(), jwtVerify: jest.fn() }));

const USER_ID = 5n;

describe('AuthController (integration, supertest)', () => {
  let app: INestApplication;
  let auth: any, securityLog: any, totp: any;

  beforeEach(async () => {
    auth = {
      rotateRefreshToken: jest.fn().mockResolvedValue({ accessToken: 'access-jwt', refreshToken: 'new-refresh', expiresIn: 900 }),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
      verifyAccessToken: jest.fn((t: string) => {
        if (t === 'bad') throw new UnauthorizedException('bad');
        return { userId: USER_ID };
      }),
      getUserProviders: jest.fn().mockResolvedValue([{ provider: 'google', email: 'a@b.com', displayName: 'Аня' }]),
    };
    securityLog = { log: jest.fn() };
    totp = { getStatus: jest.fn().mockResolvedValue({ enabled: false, recoveryCodesLeft: 0 }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn().mockReturnValue('x') } },
        { provide: AuthProviderRegistry, useValue: {} },
        { provide: MergeService, useValue: {} },
        { provide: SecurityLogService, useValue: securityLog },
        { provide: TotpService, useValue: totp },
        { provide: EmailService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  const CSRF = ['x-requested-with', 'XMLHttpRequest'] as const;

  describe('CSRF-защита', () => {
    it('POST /refresh без CSRF-заголовка и не-JSON → 401 + аудит csrf_blocked', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Content-Type', 'text/plain')
        .send('x')
        .expect(401);
      expect(securityLog.log).toHaveBeenCalledWith('csrf_blocked', expect.objectContaining({ endpoint: 'refresh' }));
      expect(auth.rotateRefreshToken).not.toHaveBeenCalled();
    });

    it('POST /logout без CSRF → 401 csrf_blocked', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Content-Type', 'text/plain')
        .send('x')
        .expect(401);
      expect(securityLog.log).toHaveBeenCalledWith('csrf_blocked', expect.objectContaining({ endpoint: 'logout' }));
    });
  });

  describe('POST /refresh', () => {
    it('с CSRF, но без refresh-cookie → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set(...CSRF)
        .expect(401);
      expect(auth.rotateRefreshToken).not.toHaveBeenCalled();
    });

    it('с CSRF + refresh-cookie → ротация и новая httpOnly/secure/strict-cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set(...CSRF)
        .set('Cookie', 'refresh_token=old-raw')
        .expect(200);
      expect(auth.rotateRefreshToken.mock.calls[0][0]).toBe('old-raw'); // ротация по cookie
      expect(res.body).toEqual({ accessToken: 'access-jwt', expiresIn: 900 });
      const setCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refresh_token='))!;
      expect(setCookie).toContain('new-refresh');
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/Secure/i);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      expect(setCookie).toContain('Path=/api/auth');
    });
  });

  describe('POST /logout', () => {
    it('с CSRF + cookie → отзывает сессию и чистит cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set(...CSRF)
        .set('Cookie', 'refresh_token=raw')
        .expect(200);
      expect(auth.revokeSession).toHaveBeenCalledWith('raw');
      const setCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refresh_token='))!;
      expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i); // cookie очищена
    });

    it('logout?all=true → отзывает все сессии', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout?all=true')
        .set(...CSRF)
        .set('Cookie', 'refresh_token=raw')
        .expect(200);
      expect(auth.revokeAllSessions).toHaveBeenCalled();
    });
  });

  describe('GET /me (JwtAuthGuard навешан)', () => {
    it('без Bearer → 401', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('с валидным Bearer → 200 с провайдерами и статусом 2FA', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer good')
        .expect(200);
      expect(res.body.userId).toBe('5');
      expect(res.body.providers).toHaveLength(1);
      expect(res.body.totp).toEqual({ enabled: false, recoveryCodesLeft: 0 });
    });
  });
});
