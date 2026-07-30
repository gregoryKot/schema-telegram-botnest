// Трипваер (TEST_IMPROVEMENT_PLAN.md, этап 1.3): «каждый guarded-маршрут
// вызван хотя бы одним e2e». route-auth.invariants.spec.ts проверяет, что
// каждый контроллер ЗАЩИЩЁН (гвард примонтирован) — но не проверяет, что кто-
// то вообще ходит на его роуты через настоящий HTTP-стек. Дыра нашлась именно
// так: SettingsController существовал с PR #43, ни разу не был добавлен в
// ApiModule.controllers — GET/POST /api/settings 404 на проде, но ни один
// юнит- или трипваер-тест этого не ловил (см. BUG-тест в
// app-ownership-sweep-3.e2e-spec.ts).
//
// Классификация guarded-контроллеров — общий источник controller-
// classification.ts (см. route-auth.invariants.spec.ts). Парсинг здесь
// намеренно простой (regex, не AST) — как и сам «e2e SMOKE»-стиль соседних
// файлов: он ловит очевидный дрейф (роут появился, но никто на него не
// ходит), а не гарантирует полноту. Тесты, которые строят URL через
// переменную (не литерал прямо в `.get(...)`/`.post(...)`), парсер не увидит
// — пиши литерал (или шаблонную строку с `${}`) прямо у вызова, как это
// сделано в app-ownership-sweep*.e2e-spec.ts (см. комментарий у `del` в
// app-ownership-sweep-2.e2e-spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from './collect-source-files';
import { SRC, guardedControllers } from './controller-classification';

const TEST_DIR = join(__dirname, '../../test');

const CONTROLLER_PREFIX_RE = /@Controller\(\s*(?:'([^']*)')?\s*\)/;
const ROUTE_DECORATOR_RE =
  /@(Get|Post|Patch|Delete|Put)\(\s*(?:'([^']*)')?[^)]*\)/g;

interface Route {
  method: string;
  path: string;
  key: string;
  controller: string;
}

/** :id, :clientId, :mapId, ... — все именованные параметры сводим к :param
 * для сверки с e2e-вызовами (там вместо имени параметра — конкретное значение). */
function normalizeParams(path: string): string {
  return path
    .split('/')
    .map((seg) => (seg.startsWith(':') ? ':param' : seg))
    .join('/');
}

function guardedRoutes(): Route[] {
  const routes: Route[] = [];
  for (const rel of guardedControllers()) {
    const src = readFileSync(join(SRC, rel), 'utf8');
    const prefix = CONTROLLER_PREFIX_RE.exec(src)?.[1] ?? '';
    ROUTE_DECORATOR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ROUTE_DECORATOR_RE.exec(src))) {
      const method = m[1].toUpperCase();
      const raw = (
        '/' + [prefix, m[2] ?? ''].filter(Boolean).join('/')
      ).replace(/\/+/g, '/');
      routes.push({
        method,
        path: raw,
        key: `${method} ${normalizeParams(raw)}`,
        controller: rel,
      });
    }
  }
  return routes;
}

// Прямой вызов: `.get('/api/x')`, `.post(\`/api/x/${id}\`)`, ...
const CALL_RE = /\.(get|post|patch|put|delete)\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
// Конвенция app-ownership-sweep.e2e-spec.ts: ARRAY_ENDPOINTS хранит GET-цель
// в поле `list:`, вызывается позже как `a.get(list)` — литерал не стоит
// прямо рядом с `.get(`.
const LIST_FIELD_RE = /\blist:\s*(`[^`]*`|'[^']*'|"[^"]*")/g;

function literalToKey(method: string, raw: string): string | null {
  let path = raw.replace(/\$\{[^}]*\}/g, ':param').split('?')[0];
  if (!path.startsWith('/')) return null;
  path = path
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) || seg === ':param' ? ':param' : seg))
    .join('/');
  return `${method} ${path}`;
}

function calledRouteKeys(): Set<string> {
  const keys = new Set<string>();
  const files = collectSourceFiles(TEST_DIR, {
    filter: (p) => p.endsWith('.e2e-spec.ts'),
  });
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    let m: RegExpExecArray | null;
    CALL_RE.lastIndex = 0;
    while ((m = CALL_RE.exec(src))) {
      const key = literalToKey(m[1].toUpperCase(), m[2].slice(1, -1));
      if (key) keys.add(key);
    }
    LIST_FIELD_RE.lastIndex = 0;
    while ((m = LIST_FIELD_RE.exec(src))) {
      const key = literalToKey('GET', m[1].slice(1, -1));
      if (key) keys.add(key);
    }
  }
  return keys;
}

// Allowlist остатка (этап 1.3, 2026-07-27) — каждый маршрут с причиной, почему
// он не вызывается ни в одном e2e-spec СЕЙЧАС. Может только СОКРАЩАТЬСЯ (см.
// ратчет-тест ниже) — новый guarded-маршрут без e2e добавляется сюда явно, не
// проходит незамеченным.
const REASON = {
  MISC_ACCOUNT:
    'мелкие технические ручки api.controller.ts (UI-флаги/черновики/профиль/' +
    'disclaimer/init/hard-delete аккаунта) — не user-data ownership в фокусе ' +
    'этапа 1.3, кандидат для отдельного захода',
  EXERCISES_DELETE:
    'DELETE по id — тот же паттерн, что уже покрыт для diary/practices ' +
    '(DELETE_ENDPOINTS в app-ownership-sweep-2.e2e-spec.ts), не сделано в этом проходе',
  JOURNEY:
    'read-only агрегат поверх уже покрытых по отдельности таблиц (rating/diary/practice)',
  AUTH_LOGIN:
    'login/OAuth/recovery-контур: auth-flows.e2e-spec.ts покрывает основной путь ' +
    '(2fa setup/enable/challenge, refresh/logout, telegram webapp/widget); email ' +
    'magic-link callback, recovery-email, provider link/unlink и OAuth redirect ' +
    '(302 на провайдера, не JSON API) — вне фокуса этапа 1.3',
  THERAPY:
    'therapy-контур покрыт по основным сценариям therapy-ownership*.e2e-spec.ts ' +
    '(14 сценариев T1/T2/C1); эти конкретные ручки (клиенты virtual/add/rename/' +
    'remove, therapist-view/resign, custom-modes DELETE, tasks history/complete, ' +
    'диагностические client/:id срезы) — не в этом проходе',
} as const;

const NOT_YET_COVERED: Array<{ route: string; reason: string }> = [
  { route: 'GET /api/link-token', reason: REASON.MISC_ACCOUNT },
  { route: 'GET /api/user-flags', reason: REASON.MISC_ACCOUNT },
  { route: 'POST /api/user-flags', reason: REASON.MISC_ACCOUNT },
  { route: 'GET /api/drafts', reason: REASON.MISC_ACCOUNT },
  { route: 'POST /api/drafts/:param', reason: REASON.MISC_ACCOUNT },
  { route: 'DELETE /api/drafts/:param', reason: REASON.MISC_ACCOUNT },
  { route: 'GET /api/profile', reason: REASON.MISC_ACCOUNT },
  { route: 'POST /api/profile/name', reason: REASON.MISC_ACCOUNT },
  { route: 'POST /api/init', reason: REASON.MISC_ACCOUNT },
  { route: 'GET /api/disclaimer', reason: REASON.MISC_ACCOUNT },
  { route: 'POST /api/disclaimer', reason: REASON.MISC_ACCOUNT },
  { route: 'DELETE /api/user', reason: REASON.MISC_ACCOUNT },
  { route: 'GET /api/healthy-phrase', reason: REASON.JOURNEY },
  {
    route: 'DELETE /api/belief-checks/:param',
    reason: REASON.EXERCISES_DELETE,
  },
  { route: 'DELETE /api/letters/:param', reason: REASON.EXERCISES_DELETE },
  { route: 'DELETE /api/flashcards/:param', reason: REASON.EXERCISES_DELETE },
  { route: 'GET /api/journey', reason: REASON.JOURNEY },
  { route: 'POST /api/auth/2fa/disable', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/2fa/recovery-codes', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/recovery-email/start', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/recovery-email/verify', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/recovery/request', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/recovery/confirm', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/email/link', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/email/callback', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/email/link-to-account', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/merge', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/link/:param', reason: REASON.AUTH_LOGIN },
  { route: 'POST /api/auth/unlink/:param', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/google', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/google/callback', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/vk', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/vk/callback', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/telegram-oidc', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/telegram-oidc/callback', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/telegram/redirect', reason: REASON.AUTH_LOGIN },
  {
    route: 'GET /api/auth/telegram/widget-redirect',
    reason: REASON.AUTH_LOGIN,
  },
  { route: 'GET /api/auth/me', reason: REASON.AUTH_LOGIN },
  { route: 'GET /api/auth/link-token', reason: REASON.AUTH_LOGIN },
  { route: 'DELETE /api/therapy/custom-modes/:param', reason: REASON.THERAPY },
  { route: 'DELETE /api/therapy/mode-maps/map/:param', reason: REASON.THERAPY },
  { route: 'GET /api/therapy/my-mode-maps/:param', reason: REASON.THERAPY },
  { route: 'GET /api/therapy/relation', reason: REASON.THERAPY },
  { route: 'DELETE /api/therapy/clients/:param', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/clients/virtual', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/clients/add', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/rename-client/:param', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/become-therapist', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/request', reason: REASON.THERAPY },
  { route: 'GET /api/therapy/request', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/therapist-view', reason: REASON.THERAPY },
  { route: 'DELETE /api/therapy/therapist-role', reason: REASON.THERAPY },
  { route: 'DELETE /api/therapy/notes/:param', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/session-info/:param', reason: REASON.THERAPY },
  { route: 'GET /api/therapy/tasks', reason: REASON.THERAPY },
  { route: 'GET /api/therapy/tasks/history', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/tasks/:param/complete', reason: REASON.THERAPY },
  { route: 'POST /api/therapy/request-ysq/:param', reason: REASON.THERAPY },
  { route: 'GET /api/therapy/client/:param/diary', reason: REASON.THERAPY },
  {
    route: 'GET /api/therapy/client/:param/schema-notes',
    reason: REASON.THERAPY,
  },
  {
    route: 'GET /api/therapy/client/:param/mode-notes',
    reason: REASON.THERAPY,
  },
  { route: 'GET /api/therapy/client-history/:param', reason: REASON.THERAPY },
];
const NOT_YET_COVERED_KEYS = new Set(NOT_YET_COVERED.map((e) => e.route));

describe('трипваер: каждый guarded-маршрут вызван хотя бы одним e2e', () => {
  const routes = guardedRoutes();
  const called = calledRouteKeys();

  it('санити: парсер находит больше 100 guarded-маршрутов', () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it('санити: известные покрытые маршруты не сидят в allowlist', () => {
    const known = [
      'GET /api/schema-notes',
      'POST /api/schema-notes',
      'GET /api/therapy/notes/:param',
      'POST /api/therapy/notes/:param',
    ];
    for (const k of known) expect(NOT_YET_COVERED_KEYS.has(k)).toBe(false);
  });

  it.each(routes)(
    '$method $path вызван в e2e или в allowlist ($controller)',
    (r) => {
      const covered = called.has(r.key) || NOT_YET_COVERED_KEYS.has(r.key);
      expect(covered).toBe(true);
    },
  );

  it('allowlist соответствует реально непокрытым маршрутам (без мусора)', () => {
    // Каждая запись allowlist обязана указывать на РЕАЛЬНО существующий
    // guarded-маршрут — иначе это мёртвая запись, маскирующая то, что
    // маршрут переименовали/удалили без обновления списка.
    const routeKeys = new Set(routes.map((r) => r.key));
    const stale = NOT_YET_COVERED.filter((e) => !routeKeys.has(e.route));
    expect(stale).toEqual([]);
  });

  it('ратчет: allowlist может только сокращаться (сейчас ≤62)', () => {
    expect(NOT_YET_COVERED.length).toBeLessThanOrEqual(62);
  });
});
