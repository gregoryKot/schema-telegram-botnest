// Сверка заглушки браузерного смока с настоящим сервером (ci-alarm #903: стаб
// отвечал `{}` там, где сервер отдаёт массив, и смок был красным 8 дней).
// Каждая ручка из экспортируемых карт «МЕТОД /путь» → тело в
// e2e-browser/support/stubFixtures.ts уходит в НАСТОЯЩИЙ AppModule от имени
// того, кого изображает стаб: клиент без данных, форма обращения «ты»
// выбрана, дисклеймер принят. Статус и тело сверяются; у каждой ручки свой
// свежий пользователь, чтобы POST не менял ответ соседних GET.
// Карты подхватываются сами: любой экспорт-объект с ключами «МЕТОД /путь»,
// кроме STATUS (там статусы). Карта с ANON/PUBLIC в имени уходит без токена —
// так сверяются и ответы гостю (e2e-browser/support/stubPublic.ts). Кабинет
// (CABINET_FIXTURES, e2e-browser/support/therapistCabinet.ts) уходит от имени
// терапевта с офлайн-клиентом — оба заводятся так же, свежими на каждую ручку.
// Живая база (buildRealDbTestApp, джоба `migrations`). Фейковая Prisma тут не
// годится: на ней часть ручек отвечает не так, как сервер.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as stubFixtures from '../e2e-browser/support/stubFixtures';
import { PUBLIC_FIXTURES } from '../e2e-browser/support/stubPublic';
import {
  CABINET_FIXTURES,
  OFFLINE_CLIENT,
  THERAPIST_NAME,
} from '../e2e-browser/support/therapistCabinet';
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
  'GET /api/therapy/clients': {
    '*.telegramId': 'офлайн-клиент — минус id связи, его выдаёт база',
    '*.urlCode': 'случайный код адреса карточки',
    '*.relationCreatedAt': 'время создания связи',
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
    provider: 'vk',
    hostId: 'web',
  },
  // deviceCode подставляется из настоящего старта: на неизвестный код сервер
  // отвечает expired, а стаб изображает билет, который ещё никто не подтвердил.
  'POST /api/auth/ticket/poll': {},
  'POST /api/therapy/therapist-view': { on: true }, // переключатель «Клиент / Терапевт»
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
  const cabinet = Object.entries(CABINET_FIXTURES).map(
    ([key, fixture], i) =>
      [key, fixture, BASE + 1_000n + BigInt(i + 1)] as const,
  );
  const allIds = [...ids, ...cabinet.map(([, , id]) => id)];

  beforeAll(async () => {
    // Всегда живая база, не по флагу окружения: на фейке спек ничего не доказывает.
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanupOwnershipFixtures(prisma, allIds);
  });
  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, allIds);
    await app.close();
  });

  /** Настоящий старт билета входа: deviceCode и userCode. */
  async function startTicket(): Promise<Record<string, string>> {
    const start = await request(app.getHttpServer())
      .post('/api/auth/ticket/start')
      .set('x-requested-with', 'webapp')
      .send({ intent: 'login', provider: 'vk' });
    return start.body as Record<string, string>;
  }

  /** Куку refresh выдаёт настоящий вход по тикету. */
  async function refreshCookie(userId: bigint): Promise<string> {
    const { deviceCode, userCode } = await startTicket();
    // Вход в браузере одобряет аккаунт со способом входа кроме Telegram.
    await prisma.authProvider.create({
      data: { userId, provider: 'vk', providerId: `e2e-stub-${userId}` },
    });
    await app.get(LoginTicketService).approveLogin(userCode, userId);
    const polled = await request(app.getHttpServer())
      .post('/api/auth/ticket/poll')
      .set('x-requested-with', 'webapp')
      .send({ deviceCode });
    const raw = polled.headers['set-cookie'] as unknown as string[];
    return raw.find((c) => c.startsWith('refresh_token='))!.split(';')[0];
  }

  /** Ручка от имени `token` (null — гость), как её зовёт сайт; статус и тело — как у стаба. */
  async function expectLikeStub(
    key: string,
    fixture: unknown,
    opts: {
      path: string;
      token: string | null;
      body?: unknown;
      cookie?: string | null;
      status?: number;
    },
  ): Promise<void> {
    const method = key.split(' ')[0];
    let req = request(app.getHttpServer())[method === 'GET' ? 'get' : 'post'](
      opts.path + (QUERIES[key] ?? ''),
    );
    if (opts.token) req = req.set('Authorization', `Bearer ${opts.token}`);
    if (method !== 'GET') {
      if (!(key in BODIES)) {
        throw new Error(`${key}: нет валидного тела в BODIES спека сверки`);
      }
      // CSRF как у сайта (requireCsrf): заголовок x-requested-with.
      req = req
        .set('x-requested-with', 'webapp')
        .send((opts.body ?? BODIES[key]) as object);
    }
    if (opts.cookie) req = req.set('Cookie', opts.cookie);
    const res = await req;

    const status =
      opts.status ?? STATUS[key] ?? (method === 'POST' ? 201 : 200);
    expect({ key, status: res.status }).toEqual({ key, status });
    if (fixture === null) {
      expect({ key, body: res.text }).toEqual({ key, body: '' });
    } else {
      expect({ key, body: masked(key, res.body) }).toEqual({
        key,
        body: masked(key, fixture),
      });
    }
  }

  it('карты фикстур найдены и непусты', () => {
    expect(MAPS.map(([n]) => n)).toContain('FIXTURES');
    expect(cases.length).toBeGreaterThan(0);
    expect(cabinet.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c, i) => [c.key, c, ids[i]] as const))(
    '%s',
    async (key, { name, fixture }, userId) => {
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
          : undefined;
      await expectLikeStub(key, fixture, {
        path: key.split(' ')[1],
        token: isGuest(name) ? null : signAccessToken(userId, secret()),
        body,
        cookie,
        // Публичные ручки — GET и @HttpCode(200): стаб отвечает на них 200.
        status: isGuest(name) ? 200 : undefined,
      });
    },
  );

  // Кабинет: у каждой ручки свой терапевт (роль и therapistMode — как после одобрения заявки)
  // и офлайн-клиент, заведённый ручкой «Новый клиент». Номер клиента выдаёт база: он встаёт в
  // путь вместо номера фикстуры, а в теле номер, код и время связи сверяются по типу (VOLATILE).
  it.each(cabinet)('кабинет: %s', async (key, fixture, therapistId) => {
    await prisma.user.create({
      data: {
        id: therapistId,
        role: 'THERAPIST',
        therapistMode: true,
        firstName: THERAPIST_NAME,
        addressForm: 'ty',
        disclaimerAccepted: true,
      },
    });
    const token = signAccessToken(therapistId, secret());
    const added = await request(app.getHttpServer())
      .post('/api/therapy/clients/virtual')
      .set('Authorization', `Bearer ${token}`)
      .set('x-requested-with', 'webapp')
      .send({ name: OFFLINE_CLIENT.name });
    expect(added.status).toBe(201);
    const [{ telegramId }] = added.body as { telegramId: number }[];
    const path = key
      .split(' ')[1]
      .replace(
        new RegExp(`/${OFFLINE_CLIENT.telegramId}(?=/|$)`),
        `/${telegramId}`,
      );
    await expectLikeStub(key, fixture, { path, token });
  });
});
