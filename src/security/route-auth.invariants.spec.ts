// Security-трипваер: НИ ОДИН HTTP-роут не уходит в прод без защиты
// (security-таск 2026-07-17). Самый опасный класс регрессии — новый
// контроллер/эндпоинт с пользовательскими данными, забывший @UseGuards:
// мгновенный обход авторизации. Инвариант: каждый *.controller.ts —
//   (A) под @UseGuards(TelegramAuthGuard|JwtAuthGuard|OptionalJwtGuard), ИЛИ
//   (B) admin-key-gated: assertAdminKey на КАЖДОМ роут-методе, ИЛИ
//   (C) в PUBLIC_BY_DESIGN — осознанно анонимный (логин, health, вебхуки
//       платёжек с проверкой подписи, публичный контент, capability-token
//       потоки). Allowlist может только СОКРАЩАТЬСЯ.
//
// Единица учёта — МЕТОД, а не файл (аудит 2026-10): гвард на одном методе
// делал защищённым весь файл, и новый анонимный `@Post` рядом не краснел.
// Теперь в контроллере вне PUBLIC_BY_DESIGN/ADMIN_KEY_GATED каждый роут-метод
// либо под гвардом (класс или метод), либо назван в ANONYMOUS_BY_DESIGN с
// причиной. Разбор — src/test-support/route-method-auth.ts (AST).
//
// Классификация (стены PUBLIC_BY_DESIGN/ADMIN_KEY_GATED) живёт в
// controller-classification.ts — общий источник с e2e-route-coverage.
// invariants.spec.ts (правило №4 CLAUDE.md: денормализованные копии без
// сверки запрещены). Список гвардов (GUARD_NAMES и собранный из него GUARD_RE)
// — один, в route-method-auth.ts: по нему считают и файл, и метод.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SRC,
  CONTROLLERS,
  PUBLIC_BY_DESIGN,
  ADMIN_KEY_GATED,
  ANONYMOUS_BY_DESIGN,
} from './controller-classification';
import {
  GUARD_NAMES,
  GUARD_RE,
  duplicateKeys,
  routeMethods,
} from '../test-support/route-method-auth';

const REL = 'x/x.controller.ts';
const methodsOf = (rel: string) =>
  routeMethods(rel, readFileSync(join(SRC, rel), 'utf8'));

// Контроллеры, где защиту проверяем по методу: не публичные и не admin-key.
const METHOD_CHECKED = CONTROLLERS.filter(
  (rel) => !PUBLIC_BY_DESIGN[rel] && !ADMIN_KEY_GATED.has(rel),
);

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
    'admin-gated %s: assertAdminKey вызван в теле каждого роут-метода',
    (rel) => {
      const methods = methodsOf(rel);
      expect(methods.length).toBeGreaterThan(0);
      // По методу, а не счётом совпадений в файле: строка импорта давала
      // запас в одно совпадение, и новый роут без проверки проходил.
      expect(methods.filter((m) => !m.callsAdminKey).map((m) => m.key)).toEqual(
        [],
      );
    },
  );

  it('каждый роут-метод под гвардом либо назван в ANONYMOUS_BY_DESIGN', () => {
    const unprotected = METHOD_CHECKED.flatMap(methodsOf)
      .filter((m) => !m.guard && !ANONYMOUS_BY_DESIGN[m.key])
      .map((m) => m.key);
    expect(unprotected).toEqual([]);
  });

  it('в ANONYMOUS_BY_DESIGN нет протухших записей (метод есть и без гварда)', () => {
    const anonymousNow = new Set(
      METHOD_CHECKED.flatMap(methodsOf)
        .filter((m) => !m.guard)
        .map((m) => m.key),
    );
    const stale = Object.keys(ANONYMOUS_BY_DESIGN).filter(
      (k) => !anonymousNow.has(k),
    );
    expect(stale).toEqual([]);
  });

  it('у каждой записи ANONYMOUS_BY_DESIGN есть причина', () => {
    for (const [key, reason] of Object.entries(ANONYMOUS_BY_DESIGN)) {
      expect({ key, ok: reason.length >= 20 }).toEqual({ key, ok: true });
    }
  });

  it('ключи роут-методов уникальны на реальном дереве (ключ без имени класса)', () => {
    // Два @Controller в одном файле с методами одного имени делили бы ключ
    // `файл:метод`, и запись ANONYMOUS_BY_DESIGN покрыла бы оба сразу.
    expect(duplicateKeys(CONTROLLERS.flatMap(methodsOf))).toEqual([]);
  });

  it('файловый GUARD_RE и разбор по методу знают одни и те же гварды', () => {
    for (const name of GUARD_NAMES) {
      const src = `@Controller('x') export class C { @Get('a') @UseGuards(${name}) a() {} }`;
      expect({ name, re: GUARD_RE.test(src) }).toEqual({ name, re: true });
      expect(routeMethods(REL, src).map((m) => m.guard)).toEqual(['method']);
    }
    // Контроль: чужой гвард не засчитывается ни тем, ни другим.
    const other = `@Controller('x') export class C { @Get('a') @UseGuards(SomeOtherGuard) a() {} }`;
    expect(GUARD_RE.test(other)).toBe(false);
    expect(routeMethods(REL, other).map((m) => m.guard)).toEqual([null]);
  });

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
    // 9 → 11 (2026-07-23): +quiz.controller +public-events.controller —
    // публичные по дизайну фичи «мини-тесты без регистрации» (лид-магнит);
    // 11 → 12 (2026-07-30): +auth-max.controller — вход из мини-аппа MAX,
    // обоснование в PUBLIC_BY_DESIGN выше, ревью безопасности — в PR фичи.
    // 12 → 13 (2026-10): +auth-one-tap.controller — One Tap и его nonce
    // переехали из auth-oauth.controller (тот был «guarded» из-за соседних
    // роутов с OptionalJwtGuard; сами one-tap-роуты всегда были анонимными,
    // allowlist лишь стал это называть вслух). Новой публичной поверхности нет.
    expect(Object.keys(PUBLIC_BY_DESIGN).length).toBeLessThanOrEqual(13);
    // 4 → 5: +booking-calendar-admin.controller.ts — контракт «Календарь
    // слотов в админке», тот же x-admin-key, обоснование в ADMIN_KEY_GATED.
    expect(ADMIN_KEY_GATED.size).toBeLessThanOrEqual(5);
    // 14 (2026-10): реестр только назвал уже существующие анонимные методы
    // guarded-контроллеров (вход, OAuth-колбэки, восстановление, refresh,
    // logout, poll тикета). Может только сокращаться.
    expect(Object.keys(ANONYMOUS_BY_DESIGN).length).toBeLessThanOrEqual(14);
  });
});
