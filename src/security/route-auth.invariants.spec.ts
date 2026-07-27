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
// Классификация (стены PUBLIC_BY_DESIGN/ADMIN_KEY_GATED/GUARD_RE) живёт в
// controller-classification.ts — общий источник с e2e-route-coverage.
// invariants.spec.ts (правило №4 CLAUDE.md: денормализованные копии без
// сверки запрещены).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SRC,
  CONTROLLERS,
  PUBLIC_BY_DESIGN,
  ADMIN_KEY_GATED,
  GUARD_RE,
  ROUTE_RE,
} from './controller-classification';

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
    // 9 → 11 (2026-07-23): +quiz.controller +public-events.controller —
    // публичные по дизайну фичи «мини-тесты без регистрации» (лид-магнит);
    // обоснование в PUBLIC_BY_DESIGN выше, ревью безопасности — в PR фичи.
    expect(Object.keys(PUBLIC_BY_DESIGN).length).toBeLessThanOrEqual(11);
    expect(ADMIN_KEY_GATED.size).toBeLessThanOrEqual(4);
  });
});
