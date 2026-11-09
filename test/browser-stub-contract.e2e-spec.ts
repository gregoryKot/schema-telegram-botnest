// Сверка заглушки браузерного смока с настоящим сервером (ci-alarm #903: стаб
// отвечал `{}` там, где сервер отдаёт массив, и смок был красным 8 дней).
// Каждая ручка из экспортируемых карт «МЕТОД /путь» → тело в
// e2e-browser/support/stubFixtures.ts уходит в НАСТОЯЩИЙ AppModule от имени
// того, кого изображает стаб: клиент без данных, форма обращения «ты»
// выбрана, дисклеймер принят. Статус и тело сверяются; у каждой ручки свой
// свежий пользователь, чтобы POST не менял ответ соседних GET.
// Карты подхватываются сами: любой экспорт-объект с ключами «МЕТОД /путь»,
// кроме STATUS (там статусы). Карта с ANON/PUBLIC в имени уходит без токена —
// так сверяются и ответы гостю (e2e-browser/support/stubPublic.ts).
// Живая база (buildRealDbTestApp, джоба `migrations`). Фейковая Prisma тут не
// годится: на ней часть ручек отвечает не так, как сервер.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as stubFixtures from '../e2e-browser/support/stubFixtures';
import { PUBLIC_FIXTURES } from '../e2e-browser/support/stubPublic';
import { ANALYTICS_EVENTS } from '../src/analytics/analytics.constants';
import { LoginTicketService } from '../src/auth/login-ticket/login-ticket.service';
import { TestApp } from './e2e-support/build-test-app';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { signAccessToken } from './e2e-support/jwt';

const KEY_RE = /^(GET|POST|PUT|PATCH|DELETE) \/\S*$/;
const MAPS = [
  ...Object.entries(stubFixtures),
  ['PUBLIC_FIXTURES', PUBLIC_FIXTURES],
].filter(
  ([name, v]) =>
    name !== 'STATUS' &&
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).length > 0 &&
    Object.keys(v).every((k) => KEY_RE.test(k)),
) as [string, Record<string, unknown>][];
const isGuest = (map: string) => /ANON|PUBLIC/i.test(map);
const STATUS = stubFixtures.STATUS;

// Поля, которые законно различаются между прогонами: сравниваются по типу.
// Путь: `*` — любой элемент массива, остальное — имена ключей.
const VOLATILE: Record<string, Record<string, string>> = {
  'GET /api/articles': {
    '*.id': 'autoincrement: номер зависит от порядка сида и прошлых прогонов',
    '*.updatedAt': 'время вставки сида в БД, не дата статьи',
  },
  'GET /api/auth/me': {
    userId: 'id пользователя кейса: у каждой ручки свой',
  },
  'POST /api/auth/refresh': {
    accessToken: 'JWT с временем выдачи: каждый раз другая строка',
  },
  'POST /api/auth/ticket/start': {
    deviceCode: 'случайные 64 hex на каждый билет',
    userCode: 'случайный код подтверждения на каждый билет',
  },
};

// Валидные тела POST по DTO. Ручки без записи здесь — красное, не пропуск.
const BODIES: Record<string, unknown> = {
  'POST /api/activity': {},
  'POST /api/event': { name: ANALYTICS_EVENTS[0] },
  'POST /api/public-event': {
    name: 'asset_recovered',
    meta: { kind: 'css', attempts: 1 },
  },
  'POST /api/init': { timezone: 'Europe/Moscow' },
  'POST /api/auth/refresh': {},
  'POST /api/settings': { notifyEnabled: true },
  // Тело, которое шлёт страница /login (shared/src/auth/useLoginTicket.ts).
  'POST /api/auth/ticket/start': {
    intent: 'login',
    provider: 'telegram',
    hostId: 'web',
  },
  // deviceCode подставляется из настоящего старта: на неизвестный код сервер
  // отвечает expired, а стаб изображает билет, который ещё никто не подтвердил.
  'POST /api/auth/ticket/poll': {},
};

// Ручки, которым без query сервер отвечает 400: стаб матчит путь без query.
const QUERIES: Record<string, string> = {
  'GET /api/practices': '?needId=attachment',
  'GET /api/note': '?date=2026-11-10', // tracker.controller.ts: без календарного дня — 400
};

function mask(value: unknown, path: string[]): unknown {
  if (path.length === 0) return value === null ? null : typeof value;
  const [head, ...rest] = path;
  if (head === '*' && Array.isArray(value)) {
    return value.map((v) => mask(v, rest));
  }
  if (value && typeof value === 'object' && head in value) {
    const o = value as Record<string, unknown>;
    return { ...o, [head]: mask(o[head], rest) };
  }
  return value;
}
function masked(key: string, body: unknown): unknown {
  return Object.keys(VOLATILE[key] ?? {}).reduce(
    (acc, p) => mask(acc, p.split('.')),
    body,
  );
}

describe('заглушка браузерного смока ↔ настоящие ответы сервера', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  // id ≥ 1e15 — веб-пользователь без Telegram: notifyReachable=false, как в стабе.
  const BASE = 1_000_000_000_001_000n;
  const secret = () => process.env.JWT_SECRET as string;
  const cases = MAPS.flatMap(([name, map]) =>
    Object.entries(map).map(([key, fixture]) => ({ name, key, fixture })),
  );
  const ids = cases.map((_, i) => BASE + BigInt(i + 1));

  beforeAll(async () => {
    // Всегда живая база, не по флагу окружения: на фейке спек ничего не доказывает.
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanupOwnershipFixtures(prisma, ids);
  });
  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ids);
    await app.close();
  });

  /** Настоящий старт билета входа: deviceCode и userCode. */
  async function startTicket(): Promise<Record<string, string>> {
    const start = await request(app.getHttpServer())
      .post('/api/auth/ticket/start')
      .set('x-requested-with', 'webapp')
      .send({ intent: 'login', provider: 'telegram' });
    return start.body as Record<string, string>;
  }

  /** Куку refresh выдаёт настоящий вход по тикету. */
  async function refreshCookie(userId: bigint): Promise<string> {
    const { deviceCode, userCode } = await startTicket();
    await app.get(LoginTicketService).approveLogin(userCode, userId);
    const polled = await request(app.getHttpServer())
      .post('/api/auth/ticket/poll')
      .set('x-requested-with', 'webapp')
      .send({ deviceCode });
    const raw = polled.headers['set-cookie'] as unknown as string[];
    return raw.find((c) => c.startsWith('refresh_token='))!.split(';')[0];
  }

  it('карты фикстур найдены и непусты', () => {
    expect(MAPS.map(([n]) => n)).toContain('FIXTURES');
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c, i) => [c.key, c, ids[i]] as const))(
    '%s',
    async (key, { name, fixture }, userId) => {
      const [method, path] = key.split(' ');
      await prisma.user.create({
        data: {
          id: userId,
          role: 'CLIENT',
          addressForm: 'ty',
          disclaimerAccepted: true,
        },
      });
      // Куку выдаём ДО построения запроса: supertest держит один сервер на запрос.
      const cookie =
        key === 'POST /api/auth/refresh' ? await refreshCookie(userId) : null;
      const body =
        key === 'POST /api/auth/ticket/poll'
          ? { deviceCode: (await startTicket()).deviceCode }
          : BODIES[key];
      let req = request(app.getHttpServer())[method === 'GET' ? 'get' : 'post'](
        path + (QUERIES[key] ?? ''),
      );
      if (!isGuest(name)) {
        req = req.set(
          'Authorization',
          `Bearer ${signAccessToken(userId, secret())}`,
        );
      }
      if (method !== 'GET') {
        if (!(key in BODIES)) {
          throw new Error(`${key}: нет валидного тела в BODIES спека сверки`);
        }
        // CSRF как у сайта (requireCsrf): заголовок x-requested-with.
        req = req.set('x-requested-with', 'webapp').send(body as object);
      }
      if (cookie) req = req.set('Cookie', cookie);
      const res = await req;

      // Публичные ручки — GET и @HttpCode(200): стаб отвечает на них 200.
      const expectedStatus = isGuest(name)
        ? 200
        : (STATUS[key] ?? (method === 'POST' ? 201 : 200));
      expect({ key, status: res.status }).toEqual({
        key,
        status: expectedStatus,
      });
      if (fixture === null) {
        expect({ key, body: res.text }).toEqual({ key, body: '' });
      } else {
        expect({ key, body: masked(key, res.body) }).toEqual({
          key,
          body: masked(key, fixture),
        });
      }
    },
  );
});
