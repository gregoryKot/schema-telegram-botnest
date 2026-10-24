// e2e на шве — login-CSRF (глобальный аудит 2026-10-11, security#6).
//
// Три ручки меняют подпись/код из ТЕЛА запроса на refresh-куку: telegram/webapp,
// max/webapp, ticket/poll. Без requireCsrf HTML-форма с чужого сайта
// (`enctype=application/x-www-form-urlencoded` — simple request, preflight не
// нужен) ставила жертве куку СЕССИИ АТАКУЮЩЕГО с его собственной настоящей
// initData: SPA жертвы при первом рефреше молча становилась чужим аккаунтом.
//
// Защита двухслойная: глобальный парсер формы снят (форма даёт пустое тело и
// 400 от DTO), а на самих ручках стоит requireCsrf (401), если парсер когда-нибудь
// вернут. Тест идёт настоящим AppModule с теми же парсерами тела, что в main.ts
// (installBodyParsers), и шлёт запрос так, как его шлёт браузер: без
// x-requested-with, без JSON, с Fetch Metadata cross-site. Подпись настоящая
// (HMAC считается тут по токену бота): форму отбивает не подпись, а защита.
// Контроль на каждую ручку: тот же вход JSON-ом —
// 200 и кука, иначе тест «ничего не пропускает» ничего не доказывал бы.
//
// Фейковая Prisma: суть теста — отказ до выдачи сессии, БД в нём не участвует.
// Дублировать на живом Postgres нельзя без чистки: MAX-пользователи рождаются
// в общем web-диапазоне id, а max-auth.e2e-spec считает их строки.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { LoginTicketService } from '../src/auth/login-ticket/login-ticket.service';

const hmacHex = (key: crypto.BinaryLike, data: string) =>
  crypto.createHmac('sha256', key).update(data).digest('hex');
const webAppKey = (botToken: string) =>
  crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

function telegramInitData(id: number): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id, first_name: 'Attacker' }));
  const check = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  params.set('hash', hmacHex(webAppKey(process.env.BOT_TOKEN!), check));
  return params.toString();
}

function maxInitData(id: number): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: '4c0ab423-342b-4e45-aea4-2747dbc500cd',
    chat: JSON.stringify({ id: 12345, type: 'DIALOG' }),
    user: JSON.stringify({ id, first_name: 'Attacker MAX', username: null }),
  };
  const check = Object.keys(fields)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const hash = hmacHex(webAppKey(process.env.MAX_BOT_TOKEN!), check);
  const pairs = Object.entries(fields).map(
    ([k, v]) => `${k}=${encodeURIComponent(v)}`,
  );
  return [...pairs, `hash=${hash}`].join('&');
}

const refreshCookie = (res: request.Response): string | undefined =>
  ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find(
    (c) => c.startsWith('refresh_token='),
  );

/** Top-level сабмит `<form method=POST>` с evil.site, как его шлёт браузер. */
function evilForm(req: request.Test, contentType: string): request.Test {
  return req
    .set('Content-Type', contentType)
    .set('Origin', 'https://evil.site')
    .set('Referer', 'https://evil.site/')
    .set('sec-fetch-site', 'cross-site')
    .set('sec-fetch-mode', 'navigate')
    .set('sec-fetch-dest', 'document');
}

const FORM = 'application/x-www-form-urlencoded';

describe('e2e: login-CSRF — установщики сессии требуют CSRF-заголовок', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const ATTACKER_TG = 777_000_001;
  const ATTACKER_MAX = 777_000_002;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  const srv = () => request(app.getHttpServer());

  const expectBlocked = (res: request.Response) => {
    // Два слоя, любой достаточен: парсер формы снят (пустое тело → DTO даёт
    // 400) и requireCsrf (401). Каждый слой по отдельности пинят
    // body-parsers.spec.ts и auth-session-csrf.spec.ts; здесь — что вместе на
    // настоящем стеке браузер получает отказ и не получает куку.
    expect([400, 401]).toContain(res.status);
    expect(refreshCookie(res)).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();
  };

  describe('POST /api/auth/telegram/webapp', () => {
    it('форма с чужого сайта с валидной initData → 4xx, куки нет', async () => {
      const initData = telegramInitData(ATTACKER_TG);
      const res = await evilForm(
        srv().post('/api/auth/telegram/webapp'),
        FORM,
      ).send(`initData=${encodeURIComponent(initData)}`);
      expectBlocked(res);
    });

    it('text/plain-форма (enctype=text/plain) → тоже 4xx', async () => {
      const res = await evilForm(
        srv().post('/api/auth/telegram/webapp'),
        'text/plain',
      ).send(JSON.stringify({ initData: telegramInitData(ATTACKER_TG) }));
      expectBlocked(res);
    });

    it('контроль: JSON с x-requested-with (мини-апп) → 200 и кука', async () => {
      const res = await srv()
        .post('/api/auth/telegram/webapp')
        .set('x-requested-with', 'miniapp')
        .send({ initData: telegramInitData(ATTACKER_TG) });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(refreshCookie(res)).toBeTruthy();
    });

    it('контроль: JSON без x-requested-with (клиент сайта) → 200', async () => {
      // webapp/src/auth/telegramWebAppAuth.ts шлёт только Content-Type:
      // application/json — форма такого заголовка выставить не может.
      const res = await srv()
        .post('/api/auth/telegram/webapp')
        .send({ initData: telegramInitData(ATTACKER_TG) });
      expect(res.status).toBe(200);
      expect(refreshCookie(res)).toBeTruthy();
    });
  });

  describe('POST /api/auth/max/webapp', () => {
    it('форма с чужого сайта с валидной initData → 4xx, куки нет', async () => {
      const res = await evilForm(srv().post('/api/auth/max/webapp'), FORM).send(
        `initData=${encodeURIComponent(maxInitData(ATTACKER_MAX))}`,
      );
      expectBlocked(res);
    });

    it('контроль: JSON с x-requested-with → 200 и кука', async () => {
      const res = await srv()
        .post('/api/auth/max/webapp')
        .set('x-requested-with', 'miniapp')
        .send({ initData: maxInitData(ATTACKER_MAX) });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(refreshCookie(res)).toBeTruthy();
    });
  });

  describe('POST /api/auth/ticket/poll', () => {
    it('форма с deviceCode одобренного билета → 4xx, билет не расходуется', async () => {
      // Атакующий сам выписывает билет входа и сам подтверждает его в боте.
      const attacker = await prisma.authProvider.findFirst({
        where: { provider: 'telegram', providerId: String(ATTACKER_TG) },
      });
      expect(attacker).toBeTruthy(); // создан контролем telegram/webapp выше
      const tickets = app.get(LoginTicketService);
      const { deviceCode, userCode } = await tickets.start({
        intent: 'login',
        provider: 'telegram',
        requesterUserId: null,
        hostId: 'web',
        deviceLabel: 'evil',
      });
      await tickets.approveLogin(userCode, attacker!.userId);

      const blocked = await evilForm(
        srv().post('/api/auth/ticket/poll'),
        FORM,
      ).send(`deviceCode=${deviceCode}`);
      expectBlocked(blocked);

      // Контроль на ТОМ ЖЕ билете: отказ не сжёг его (поллинг остаётся
      // доступен настоящему клиенту), а JSON-запрос получает сессию.
      const ok = await srv()
        .post('/api/auth/ticket/poll')
        .set('x-requested-with', 'ticket')
        .send({ deviceCode });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe('linked');
      expect(refreshCookie(ok)).toBeTruthy();
    });
  });

  // Парсер формы остался там, где его шлёт внешняя система: Robokassa
  // ResultURL — это form-urlencoded POST. Если бы парсер сняли целиком, оплата
  // перестала бы подтверждаться (InvId не разобрался бы), а JSON-тест
  // payment-webhooks.e2e-spec этого не заметил бы.
  it('форма Robokassa на /api/payment/result по-прежнему разбирается', async () => {
    const res = await srv()
      .post('/api/payment/result')
      .set('Content-Type', FORM)
      .send('OutSum=3000.00&InvId=987654&SignatureValue=bad');
    // Подпись неверна → FAIL<InvId>; InvId в ответе = тело формы разобрано.
    expect(res.text).toBe('FAIL987654');
  });
});
