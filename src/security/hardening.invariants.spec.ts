// Security-трипваер: глобальная защитная обвязка приложения (security-таск
// 2026-07-17). Всё приложение опирается на набор слоёв в bootstrap:
// helmet+CSP (XSS/clickjacking/MIME-sniffing), ValidationPipe whitelist
// (mass-assignment), cap тела запроса (JSON-DoS), cookie-parser, exception-
// фильтры (не течёт внутренность ошибок), HTTPS-редирект в проде. Тихое
// удаление любого слоя ослабляет всё сразу — фиксируем присутствие каждого.
//
// Слои ставит одна функция configureApp (src/infra/configure-app.ts) — её зовут
// main.ts и оба e2e-сборщика. Проверка идёт ЗАПРОСОМ через неё, а не регэкспом
// по main.ts (аудит 2026-10: регэксп не ловил второй `app.use(helmet(...))` и
// перекрытие CSP); что все три бутстрапа зовут её и не ставят слоёв сами —
// сверка исходников ниже (src/test-support/configure-app-probe.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import type { INestApplication } from '@nestjs/common';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { BODY_LIMIT, BODY_LIMIT_BYTES } from '../infra/body-limit';
import { corsOrigins } from '../infra/cors-options';
import { helmetOptions } from './helmet-config';
import { permissionsPolicyHeader } from './permissions-policy';
import {
  BOOTSTRAP_FILES,
  buildProbeApp,
  callsConfigureApp,
  ownLayers,
} from '../test-support/configure-app-probe';

const ROOT = join(__dirname, '../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const MAIN = read('src/main.ts');
const PARSERS = read('src/infra/body-parsers.ts');
const CONFIGURE = read('src/infra/configure-app.ts');
// Опции helmet (CSP) живут в отдельном модуле: configureApp только подключает их.
const HELMET_CFG = read('src/security/helmet-config.ts');

/** Заголовок, который даёт настоящий helmet с настоящим конфигом. */
async function expectedCsp(): Promise<string> {
  const bare = express();
  bare.use(helmet(helmetOptions()));
  bare.get('/', (_req, res) => {
    res.send('ok');
  });
  const res = await request(bare).get('/');
  return String(res.headers['content-security-policy']);
}

describe('трипваер: hardening-слои через configureApp', () => {
  let app: INestApplication;
  const savedOrigins = process.env.ALLOWED_ORIGINS;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    delete process.env.ALLOWED_ORIGINS;
    app = await buildProbeApp();
  });
  afterAll(async () => {
    await app.close();
    if (savedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = savedOrigins;
  });

  it('helmet: CSP ровно та, что даёт helmet(helmetOptions()), и одна', async () => {
    const res = await http().get('/api/probe/cookie').expect(200);
    const csp: unknown = res.headers['content-security-policy'];
    expect(typeof csp).toBe('string'); // не массив — заголовок ставят один раз
    expect(csp).toBe(await expectedCsp());
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  // helmet 8 Permissions-Policy не ставит — его ставит свой middleware
  // (сверка заголовка с кодом — permissions-policy.invariants.spec.ts).
  it('Permissions-Policy подключён', async () => {
    const res = await http().get('/api/probe/cookie').expect(200);
    expect(res.headers['permissions-policy']).toBe(permissionsPolicyHeader());
  });

  it('ответ /api не кэшируется (apiNoStore)', async () => {
    const res = await http().get('/api/probe/cookie').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('ValidationPipe с whitelist: недекорированное поле срезано (mass-assignment)', async () => {
    const res = await http()
      .post('/api/probe/echo')
      .send({ name: 'ok', role: 'admin' })
      .expect(201);
    expect(res.body).toEqual({ name: 'ok' });
    await http()
      .post('/api/probe/echo')
      .send({ name: 'x'.repeat(11) })
      .expect(400);
  });

  it('cap тела запроса (анти-DoS через огромный JSON)', async () => {
    // Значение — src/infra/body-limit.ts, парсеры — src/infra/body-parsers.ts.
    expect(BODY_LIMIT).toMatch(/kb$/i);
    expect(BODY_LIMIT_BYTES).toBeLessThanOrEqual(1024 * 1024);
    await http()
      .post('/api/probe/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(BODY_LIMIT_BYTES) }))
      .expect(413);
  });

  it('cookie-parser подключён', async () => {
    const res = await http()
      .get('/api/probe/cookie')
      .set('Cookie', 'sid=abc')
      .expect(200);
    expect(res.body).toEqual({ sid: 'abc' });
  });

  it('exception-фильтры навешаны: внутренность ошибки не течёт клиенту', async () => {
    const res = await http().get('/api/probe/boom').expect(500);
    expect(JSON.stringify(res.body)).not.toMatch(/секретная|таблица|token/);
  });

  it('trust proxy: адрес клиента — из X-Forwarded-For одного прокси', async () => {
    const res = await http()
      .get('/api/probe/ip')
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(200);
    expect(res.body).toEqual({ ip: '203.0.113.7' });
  });

  it('CORS: dev-origin пущен с credentials, чужой — нет', async () => {
    const ok = await http()
      .get('/api/probe/cookie')
      .set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const alien = await http()
      .get('/api/probe/cookie')
      .set('Origin', 'https://evil.example');
    expect(alien.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('HTTPS/хост-редирект вне production не стоит', async () => {
    await http()
      .get('/api/probe/cookie')
      .set('X-Forwarded-Proto', 'http')
      .expect(200);
  });
});

describe('трипваер: HTTPS-редирект только в production', () => {
  const savedEnv = process.env.NODE_ENV;
  let app: INestApplication;
  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    app = await buildProbeApp();
  });
  afterAll(async () => {
    await app.close();
    process.env.NODE_ENV = savedEnv;
  });

  it('x-forwarded-proto: http → 301 на https того же хоста', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/probe/cookie?x=1')
      .set('Host', 'schemehappens.ru')
      .set('X-Forwarded-Proto', 'http')
      .expect(301);
    expect(res.headers.location).toBe(
      'https://schemehappens.ru/api/probe/cookie?x=1',
    );
  });
});

describe('трипваер: все бутстрапы зовут configureApp, а не ставят слои сами', () => {
  it.each(BOOTSTRAP_FILES)('%s', (rel) => {
    const src = read(rel);
    expect(callsConfigureApp(src)).toBe(true);
    expect(ownLayers(src)).toEqual([]);
  });

  it.each([
    ['второй helmet рядом', 'configureApp(app);\napp.use(helmet({}));'],
    ['свой фильтр', 'configureApp(app);\napp.useGlobalFilters(new X());'],
    ['вызов закомментирован', '// configureApp(app);\n'],
  ])('контроль: %s → красный', (_name, src) => {
    expect(callsConfigureApp(src) && ownLayers(src).length === 0).toBe(false);
  });

  it('штатный парсер Nest отключён явно (иначе потолок молча падает до 100 КБ)', () => {
    // Несущая деталь, а не стилистика: пока `bodyParser: false` стоит, наш
    // парсер единственный. Без него потолок держался бы на совпадении порядка
    // `use`/`listen` и имён слоёв Nest — разбор в src/infra/body-limit.ts,
    // замер границы в test/body-limit.e2e-spec.ts.
    for (const rel of BOOTSTRAP_FILES) {
      expect(read(rel)).toMatch(/bodyParser:\s*false/);
    }
  });

  // Login-CSRF (аудит 2026-10-11, security#6): urlencoded без пути делал из
  // любого POST форму-«простой запрос» — без preflight и без заголовков.
  it('urlencoded стоит только на путях внешних форм, не глобально', () => {
    expect(CONFIGURE).not.toMatch(/urlencoded/);
    expect(PARSERS).toMatch(/json\(\s*\{\s*limit:\s*BODY_LIMIT\s*\}/);
    const uses = [...PARSERS.matchAll(/app\.use\(([^;]*?urlencoded[^;]*)\)/g)];
    expect(uses).toHaveLength(1);
    expect(uses[0][1]).toMatch(/^\s*path\s*,/);
  });
});

describe('трипваер: CSP-конфиг helmet', () => {
  it('CSP: defaultSrc self, objectSrc none, upgradeInsecureRequests', () => {
    expect(HELMET_CFG).toMatch(/contentSecurityPolicy/);
    expect(HELMET_CFG).toMatch(/defaultSrc:\s*\[\s*["']'self'["']/);
    expect(HELMET_CFG).toMatch(/objectSrc:\s*\[\s*["']'none'["']/);
    expect(HELMET_CFG).toMatch(/upgradeInsecureRequests/);
    // scriptSrc не должен быть открыт для 'unsafe-inline' по defaultSrc —
    // объявлен явным allowlist'ом.
    expect(HELMET_CFG).toMatch(/scriptSrc:/);
  });

  it("CSP scriptSrc не содержит 'unsafe-eval'", () => {
    const m = HELMET_CFG.match(/scriptSrc:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/unsafe-eval/);
  });

  // Мини-приложение в MAX грузит их мост с st.max.ru. Убрать домен из списка
  // = мост молча не загрузится, а приложение внутри мессенджера решит, что
  // открыто в браузере (зонд уже наступал на этот же CSP инлайн-скриптом).
  // И наоборот: 'unsafe-inline' сюда добавлять нельзя — загрузчик вынесен в
  // отдельный файл /max-bridge.js именно поэтому.
  it('CSP scriptSrc: мост MAX разрешён поимённо, инлайн — по-прежнему нет', () => {
    const m = HELMET_CFG.match(/scriptSrc:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const value = m![1].replace(/\s/g, '');
    expect(value).toContain('https://st.max.ru');
    expect(value).not.toMatch(/unsafe-inline/);
  });
});

// ── Аудит 2026-10 (I1–I6): инфраструктурная обвязка ──────────────────────

describe('трипваер: CSP и инлайн-скрипты (I4)', () => {
  // CSP без 'unsafe-inline' и без хешей: инлайн-<script> в HTML просто не
  // исполнится — тема в index.html годами «работала» только на бумаге.
  it("scriptSrc не содержит 'unsafe-inline' и хешей", () => {
    const m = HELMET_CFG.match(/scriptSrc:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/unsafe-inline|sha256-|nonce-/);
  });

  it.each(['webapp/index.html'])(
    '%s: нет инлайн-<script> (кроме ld+json) — CSP их блокирует',
    (rel) => {
      const html = read(rel);
      const inline = [
        ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
      ]
        .filter((m) => !/\bsrc\s*=/.test(m[1]))
        .filter((m) => !/application\/ld\+json/i.test(m[1]))
        .filter((m) => m[2].trim() !== '');
      expect(inline.map((m) => m[2].trim().slice(0, 60))).toEqual([]);
    },
  );
});

describe('трипваер: CORS не пускает алиас практики (I1)', () => {
  const saved = {
    origins: process.env.ALLOWED_ORIGINS,
    env: process.env.NODE_ENV,
  };
  afterEach(() => {
    if (saved.origins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = saved.origins;
    process.env.NODE_ENV = saved.env;
  });

  it('продовый список origin — только канонический хост', () => {
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'production';
    expect(corsOrigins()).toEqual(['https://schemehappens.ru']);
  });
});

describe('трипваер: unhandledRejection и uncaughtException (I6)', () => {
  it('main.ts регистрирует обработчик необработанных reject-ов', () => {
    expect(MAIN).toMatch(/registerUnhandledRejectionHandler\s*\(/);
  });

  it("обработчик слушает 'unhandledRejection' и пишет через Logger.error", () => {
    const src = read('src/infra/unhandled-rejection.ts');
    expect(src).toMatch(/process\.on\(\s*['"]unhandledRejection['"]/);
    expect(src).toMatch(/logger\.error\(/);
  });

  it('main.ts регистрирует и обработчик uncaughtException, тем же путём', () => {
    expect(MAIN).toMatch(/registerUncaughtExceptionHandler\s*\(/);
    const src = read('src/infra/uncaught-exception.ts');
    expect(src).toMatch(/process\.on\(\s*['"]uncaughtException['"]/);
    expect(src).toMatch(/logger\.error\(/);
  });
});

describe('трипваер: секреты вне build-контекста и права CI (I5)', () => {
  it('.dockerignore исключает .env, *.pem, *.key, но оставляет assets/ca/*.pem', () => {
    const lines = read('.dockerignore')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    expect(lines).toContain('**/.env');
    expect(lines).toContain('**/.env.*');
    expect(lines).toContain('**/*.pem');
    expect(lines).toContain('**/*.key');
    // Отрицание обязано стоять ПОСЛЕ исключения, иначе оно ничего не отменяет.
    expect(lines.indexOf('!assets/ca/*.pem')).toBeGreaterThan(
      lines.indexOf('**/*.pem'),
    );
  });

  it('ci.yml: верхнеуровневые permissions — только contents: read', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
  });
});
