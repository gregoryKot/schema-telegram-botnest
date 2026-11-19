/**
 * e2e: второй фактор на билете входа через MAX.
 *
 * Билет входа и передачи сессии подтверждают сессией мини-приложения MAX, куда
 * входят по подписи мессенджера, без кода. Спек держит шов целиком: опрос
 * билета аккаунта с 2FA отдаёт вызов, а сессию сайта — только
 * `POST /api/auth/2fa/challenge` после верного кода.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { generateSync } from 'otplib';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';

describe('e2e: вход на сайт через MAX при включённой 2FA', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const WITH_2FA = 700_000_000_000_021n;
  const PLAIN = 700_000_000_000_022n;
  const IDS = [WITH_2FA, PLAIN];
  let token2fa = '';
  let tokenPlain = '';
  let stepCode: (delta: number) => string;

  const post = (url: string, token?: string) => {
    const req = request(app.getHttpServer())
      .post(url)
      .set('x-requested-with', 'webapp');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, IDS);
    for (const id of IDS) {
      await prisma.user.upsert({
        where: { id },
        update: {},
        create: { id, firstName: 'E2E' },
      });
      await prisma.authProvider.create({
        data: { userId: id, provider: 'max', providerId: `e2e-lt2fa-${id}` },
      });
    }
    const secret = process.env.JWT_SECRET as string;
    token2fa = signAccessToken(WITH_2FA, secret);
    tokenPlain = signAccessToken(PLAIN, secret);

    const setup = await post('/api/auth/2fa/setup', token2fa);
    const totpSecret = new URL(setup.body.otpauthUrl).searchParams.get(
      'secret',
    ) as string;
    // Анти-повтор гасит шаг каждого принятого кода: включение берёт шаг −1,
    // вход — шаг 0. У границы шага −1 выпал бы из окна — ждём её.
    const toBoundary = 30_000 - (Date.now() % 30_000);
    if (toBoundary < 5_000)
      await new Promise((r) => setTimeout(r, toBoundary + 100));
    stepCode = (delta) =>
      generateSync({
        secret: totpSecret,
        epoch: Math.floor(Date.now() / 1000) + delta * 30,
      });
    const enable = await post('/api/auth/2fa/enable', token2fa).send({
      code: stepCode(-1),
    });
    expect(enable.status).toBe(200);
  }, 30_000);

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, IDS);
    await app.close();
  });

  /** Вкладка выписала билет под MAX, человек подтвердил его сессией MAX. */
  async function approvedTicket(token: string): Promise<string> {
    const start = await post('/api/auth/ticket/start').send({
      intent: 'login',
      provider: 'max',
    });
    expect(start.status).toBe(200);
    const approved = await post('/api/auth/ticket/confirm-login', token).send({
      code: start.body.userCode,
    });
    expect(approved.body.ok).toBe(true);
    return start.body.deviceCode as string;
  }

  const poll = (deviceCode: string) =>
    post('/api/auth/ticket/poll').send({ deviceCode });

  it('2FA включена: билет подтверждён → без верного кода сессии нет, с верным — есть', async () => {
    const deviceCode = await approvedTicket(token2fa);

    const polled = await poll(deviceCode);
    expect(polled.status).toBe(200);
    expect(polled.body.status).toBe('totp_required');
    expect(polled.body.accessToken).toBeUndefined();
    expect(String(polled.headers['set-cookie'])).not.toContain('refresh_token');
    const challengeToken = polled.body.challengeToken as string;
    expect(challengeToken).toEqual(expect.any(String));

    // Билет одноразовый: второго вызова и тем более сессии повтор не даёт.
    expect((await poll(deviceCode)).body).toEqual({ status: 'expired' });

    const wrong = await post('/api/auth/2fa/challenge').send({
      challengeToken,
      code: '000000',
    });
    expect(wrong.status).toBe(401);
    expect(String(wrong.headers['set-cookie'])).not.toContain('refresh_token');

    const right = await post('/api/auth/2fa/challenge').send({
      challengeToken,
      code: stepCode(0),
    });
    expect(right.status).toBe(200);
    expect(right.body.accessToken).toEqual(expect.any(String));
    expect(String(right.headers['set-cookie'])).toContain('refresh_token=');
  });

  it('2FA включена: передача сессии из MAX в браузер (handoff) тоже ждёт код', async () => {
    const issued = await post('/api/auth/ticket/handoff', token2fa).send({
      hostId: 'max',
    });
    expect(issued.status).toBe(200);

    const polled = await poll(issued.body.deviceCode as string);
    expect(polled.body.status).toBe('totp_required');
    expect(polled.body.accessToken).toBeUndefined();
    expect(String(polled.headers['set-cookie'])).not.toContain('refresh_token');
  });

  it('2FA выключена: как раньше — вкладка получает сессию опросом', async () => {
    const polled = await poll(await approvedTicket(tokenPlain));

    expect(polled.body.status).toBe('linked');
    expect(polled.body.accessToken).toEqual(expect.any(String));
    expect(polled.body.challengeToken).toBeUndefined();
    expect(String(polled.headers['set-cookie'])).toContain('refresh_token=');
  });
});
