// Security-трипваер: глобальная защитная обвязка в main.ts (security-таск
// 2026-07-17). Всё приложение опирается на набор middleware в bootstrap:
// helmet+CSP (XSS/clickjacking/MIME-sniffing), ValidationPipe whitelist
// (mass-assignment), cap тела запроса (JSON-DoS), cookie-parser, exception-
// фильтры (не течёт внутренность ошибок), HTTPS-редирект в проде. Тихое
// удаление любого слоя ослабляет всё сразу — фиксируем присутствие каждого.
import { readFileSync } from 'fs';
import { join } from 'path';

import { BODY_LIMIT, BODY_LIMIT_BYTES } from '../infra/body-limit';

const MAIN = readFileSync(join(__dirname, '../main.ts'), 'utf8');

describe('трипваер: hardening-middleware в main.ts', () => {
  it('helmet подключён', () => {
    expect(MAIN).toMatch(/helmet\s*\(/);
    expect(MAIN).toMatch(/app\.use\(\s*[\s\S]*helmet/);
  });

  it('CSP: defaultSrc self, objectSrc none, upgradeInsecureRequests', () => {
    expect(MAIN).toMatch(/contentSecurityPolicy/);
    expect(MAIN).toMatch(/defaultSrc:\s*\[\s*["']'self'["']/);
    expect(MAIN).toMatch(/objectSrc:\s*\[\s*["']'none'["']/);
    expect(MAIN).toMatch(/upgradeInsecureRequests/);
    // scriptSrc не должен быть открыт для 'unsafe-inline' по defaultSrc —
    // объявлен явным allowlist'ом.
    expect(MAIN).toMatch(/scriptSrc:/);
  });

  // Клик-джекинг: X-Frame-Options выключен осознанно (он не умеет несколько
  // источников, а мини-приложение живёт в iframe мессенджера). Значит защита
  // держится на frame-ancestors — и он обязан быть списком, а не «кому угодно».
  it('CSP frame-ancestors: явный список источников, без «всем можно»', () => {
    const m = MAIN.match(/frameAncestors:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const value = m![1].replace(/\s/g, '');
    expect(value).toContain("'self'");
    expect(value).not.toContain("'*'");
    expect(value).not.toContain('"*"');
    // Голая схема https: пустила бы любой сайт — источники только поимённо.
    expect(value).not.toMatch(/['"]https:['"]/);
  });

  it("CSP scriptSrc не содержит 'unsafe-eval'", () => {
    const m = MAIN.match(/scriptSrc:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/unsafe-eval/);
  });

  // Мини-приложение в MAX грузит их мост с st.max.ru. Убрать домен из списка
  // = мост молча не загрузится, а приложение внутри мессенджера решит, что
  // открыто в браузере (зонд уже наступал на этот же CSP инлайн-скриптом).
  // И наоборот: 'unsafe-inline' сюда добавлять нельзя — загрузчик вынесен в
  // отдельный файл /max-bridge.js именно поэтому.
  it('CSP scriptSrc: мост MAX разрешён поимённо, инлайн — по-прежнему нет', () => {
    const m = MAIN.match(/scriptSrc:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const value = m![1].replace(/\s/g, '');
    expect(value).toContain('https://st.max.ru');
    expect(value).not.toMatch(/unsafe-inline/);
  });

  it('ValidationPipe с whitelist (mass-assignment защита)', () => {
    expect(MAIN).toMatch(/new ValidationPipe\(\s*\{[^}]*whitelist:\s*true/);
  });

  it('cap тела запроса (анти-DoS через огромный JSON)', () => {
    // Значение переехало в src/infra/body-limit.ts (аудит 2026-07-20, L2),
    // поэтому проверяем не литерал в тексте, а оба парсера и сам потолок.
    expect(MAIN).toMatch(/json\(\s*\{\s*limit:\s*BODY_LIMIT\s*\}/);
    expect(MAIN).toMatch(/urlencoded\(\s*\{\s*limit:\s*BODY_LIMIT/);
    expect(BODY_LIMIT).toMatch(/kb$/i);
    // Разумный потолок: килобайты, не десятки мегабайт.
    expect(BODY_LIMIT_BYTES).toBeLessThanOrEqual(1024 * 1024);
  });

  it('штатный парсер Nest отключён явно (иначе потолок молча падает до 100 КБ)', () => {
    // Несущая деталь, а не стилистика: пока `bodyParser: false` стоит, наш
    // парсер единственный. Без него потолок держался бы на совпадении порядка
    // `use`/`listen` и имён слоёв Nest — разбор в src/infra/body-limit.ts,
    // замер границы в test/body-limit.e2e-spec.ts.
    expect(MAIN).toMatch(/bodyParser:\s*false/);
  });

  it('cookie-parser подключён', () => {
    expect(MAIN).toMatch(/cookieParser\(\)/);
  });

  it('exception-фильтры навешаны (не течёт внутренность ошибок)', () => {
    expect(MAIN).toMatch(/useGlobalFilters/);
    expect(MAIN).toMatch(/GenericExceptionFilter/);
    expect(MAIN).toMatch(/PrismaExceptionFilter/);
  });

  it('HTTPS/redirect-гейт только в production', () => {
    expect(MAIN).toMatch(/NODE_ENV\s*===\s*['"]production['"]/);
    expect(MAIN).toMatch(/x-forwarded-proto/);
  });

  it('CORS не открыт настежь (нет origin:true/\\*) безусловно', () => {
    // Разрешённые origin приходят из env/allowlist, а не origin: true всегда.
    expect(MAIN).not.toMatch(/enableCors\(\s*\{\s*origin:\s*true\s*\}/);
    expect(MAIN).not.toMatch(/enableCors\(\s*\{\s*origin:\s*['"]\*['"]/);
  });
});

// ── Аудит 2026-10 (I1–I6): инфраструктурная обвязка ──────────────────────
const ROOT = join(__dirname, '../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('трипваер: CSP и инлайн-скрипты (I4)', () => {
  // CSP без 'unsafe-inline' и без хешей: инлайн-<script> в HTML просто не
  // исполнится — тема в index.html годами «работала» только на бумаге.
  it("scriptSrc не содержит 'unsafe-inline' и хешей", () => {
    const m = MAIN.match(/scriptSrc:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/unsafe-inline|sha256-|nonce-/);
  });

  it.each(['webapp/index.html', 'schema-miniapp/index.html'])(
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
  it('продовый список origin — только канонический хост', () => {
    const m = MAIN.match(/isProd\s*\?[\s\S]*?\[\s*((?:'[^']*',?\s*)+)\]/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('https://schemehappens.ru');
    expect(m![1]).not.toContain('kotlarewski');
  });
});

describe('трипваер: unhandledRejection (I6)', () => {
  it('main.ts регистрирует обработчик необработанных reject-ов', () => {
    expect(MAIN).toMatch(/registerUnhandledRejectionHandler\s*\(/);
  });

  it("обработчик слушает 'unhandledRejection' и пишет через Logger.error", () => {
    const src = read('src/infra/unhandled-rejection.ts');
    expect(src).toMatch(/process\.on\(\s*['"]unhandledRejection['"]/);
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
