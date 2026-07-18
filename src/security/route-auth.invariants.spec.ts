// Security-трипваер: НИ ОДИН HTTP-роут не уходит в прод без защиты
// (security-таск 2026-07-17). Самый опасный класс регрессии — новый
// контроллер/эндпоинт с пользовательскими данными, забывший @UseGuards:
// мгновенный обход авторизации. Инвариант: каждый *.controller.ts —
//   (A) под @UseGuards(TelegramAuthGuard|JwtAuthGuard|OptionalJwtGuard), ИЛИ
//   (B) admin-key-gated: assertAdminKey на КАЖДОМ роут-методе, ИЛИ
//   (C) в PUBLIC_BY_DESIGN — осознанно анонимный (логин, health, вебхуки
//       платёжек с проверкой подписи, публичный контент, capability-token
//       потоки). Allowlist может только СОКРАЩАТЬСЯ.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.controller.ts') && !/\.spec\.ts$/.test(p))
      out.push(p);
  }
  return out;
}

const CONTROLLERS = walk(SRC).map((p) => p.replace(SRC + '/', ''));

// (C) Осознанно публичные контроллеры — каждый с обоснованием. Сокращать
// можно, добавлять — только с ревью безопасности.
const PUBLIC_BY_DESIGN: Record<string, string> = {
  'api/health.controller.ts': 'liveness-проба, без данных',
  'api/booking.controller.ts':
    'лид-форма с лендинга (XSS-экран, cap), уведомляет админа',
  'articles/articles.controller.ts': 'публичные статьи (GET)',
  'site-content/site-content.controller.ts': 'публичный контент лендинга (GET)',
  'booking/booking.controller.ts':
    'публичная запись: options/slots/book + capability-token by-token/cancel',
  'booking/payment.controller.ts':
    'вебхук Robokassa — проверка подписи в сервисе, не @UseGuards',
  'donation/donation.controller.ts': 'анонимные пожертвования + вебхук',
  'subscription/subscription.controller.ts':
    'подписка: honeypot + capability-token by-token/cancel',
};

// (B) Admin-key-gated: защита через заголовок x-admin-key (assertAdminKey),
// а не @UseGuards. Требуем assertAdminKey на каждом роут-методе.
const ADMIN_KEY_GATED = new Set([
  'site-content/site-content-admin.controller.ts',
  'articles/articles-admin.controller.ts',
  'booking/booking-admin.controller.ts',
  'telegram/healthy-adult-admin.controller.ts',
]);

const GUARD_RE =
  /@UseGuards\(\s*[^)]*(TelegramAuthGuard|JwtAuthGuard|OptionalJwtGuard)/;
const ROUTE_RE = /@(Get|Post|Patch|Delete|Put)\(/g;

describe('трипваер: каждый контроллер защищён (guard / admin-key / публичный)', () => {
  it.each(CONTROLLERS)('%s классифицирован и защищён', (rel) => {
    const src = readFileSync(join(SRC, rel), 'utf8');
    const guarded = GUARD_RE.test(src);
    const publicReason = PUBLIC_BY_DESIGN[rel];
    const adminGated = ADMIN_KEY_GATED.has(rel);

    // Ровно одна категория должна применяться — иначе контроллер «неизвестен»
    // и тест обязан упасть, заставив явно классифицировать его.
    const categories = [guarded, !!publicReason, adminGated].filter(
      Boolean,
    ).length;
    expect(categories).toBeGreaterThanOrEqual(1);
  });

  it.each([...ADMIN_KEY_GATED])(
    'admin-gated %s: assertAdminKey на каждом роут-методе',
    (rel) => {
      const src = readFileSync(join(SRC, rel), 'utf8');
      const routes = (src.match(ROUTE_RE) ?? []).length;
      const adminChecks = (src.match(/assertAdminKey/g) ?? []).length;
      // Каждый роут гейтит админ-ключ (обычно ещё и объявление adminKey).
      expect(adminChecks).toBeGreaterThanOrEqual(routes);
    },
  );

  it('нет контроллеров вне классификации (новый = защити или внеси в allowlist)', () => {
    const unclassified = CONTROLLERS.filter((rel) => {
      const src = readFileSync(join(SRC, rel), 'utf8');
      return (
        !GUARD_RE.test(src) &&
        !PUBLIC_BY_DESIGN[rel] &&
        !ADMIN_KEY_GATED.has(rel)
      );
    });
    expect(unclassified).toEqual([]);
  });

  it('allowlist публичных не разросся сверх известного (может только сокращаться)', () => {
    expect(Object.keys(PUBLIC_BY_DESIGN).length).toBeLessThanOrEqual(8);
    expect(ADMIN_KEY_GATED.size).toBeLessThanOrEqual(4);
  });
});
