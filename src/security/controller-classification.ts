// Общая классификация *.controller.ts — guarded (A) / admin-key-gated (B) /
// public-by-design (C). Единственный источник правды для двух трипваеров
// (route-auth.invariants.spec.ts и e2e-route-coverage.invariants.spec.ts):
// правило №4 CLAUDE.md запрещает денормализованные копии без сверки — если
// бы у каждого спека была своя копия PUBLIC_BY_DESIGN/ADMIN_KEY_GATED, они
// могли бы разойтись (один спек «забыл» новый публичный контроллер).
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export const SRC = join(__dirname, '..');

export function walkControllers(dir: string = SRC): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkControllers(p));
    else if (p.endsWith('.controller.ts') && !/\.spec\.ts$/.test(p))
      out.push(p);
  }
  return out;
}

export const CONTROLLERS = walkControllers().map((p) =>
  p.replace(SRC + '/', ''),
);

// (C) Осознанно публичные контроллеры — каждый с обоснованием. Сокращать
// можно, добавлять — только с ревью безопасности.
export const PUBLIC_BY_DESIGN: Record<string, string> = {
  'api/health.controller.ts': 'liveness-проба, без данных',
  'api/client-errors.controller.ts':
    'телеметрия крашей фронта — без auth (краш до логина), троттлинг по IP + AlertLogger',
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
  'api/quiz.controller.ts':
    'мини-тесты без регистрации: статический контент из quiz-registry (GET), ' +
    'пользовательских данных нет, троттлинг по IP',
  'api/public-events.controller.ts':
    'анонимная аналитика мини-тестов и лендинга: только quiz_started/' +
    'quiz_completed/practice_link_click, meta режется по реестрам ' +
    '(тесты, места клика), userId = null, троттлинг по IP',
};

// (B) Admin-key-gated: защита через заголовок x-admin-key (assertAdminKey),
// а не @UseGuards. Требуем assertAdminKey на каждом роут-методе.
export const ADMIN_KEY_GATED = new Set([
  'site-content/site-content-admin.controller.ts',
  'articles/articles-admin.controller.ts',
  'booking/booking-admin.controller.ts',
  'telegram/healthy-adult-admin.controller.ts',
]);

export const GUARD_RE =
  /@UseGuards\(\s*[^)]*(TelegramAuthGuard|JwtAuthGuard|OptionalJwtGuard)/;
export const ROUTE_RE = /@(Get|Post|Patch|Delete|Put)\(/g;

export type Classification = 'guarded' | 'admin' | 'public' | 'unknown';

export function classify(rel: string): Classification {
  if (ADMIN_KEY_GATED.has(rel)) return 'admin';
  if (PUBLIC_BY_DESIGN[rel]) return 'public';
  const src = readFileSync(join(SRC, rel), 'utf8');
  if (GUARD_RE.test(src)) return 'guarded';
  return 'unknown';
}

/** Относительные пути (`api/diary.controller.ts`) контроллеров категории (A). */
export function guardedControllers(): string[] {
  return CONTROLLERS.filter((rel) => classify(rel) === 'guarded');
}
