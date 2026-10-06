// Список публичных маршрутов Метрики + сверка с маршрутами App.tsx
// (правило №4 CLAUDE.md): новый маршрут без классификации роняет тест.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicMetrikaRoute } from './metrikaRoutes';

// Маршруты, которым счётчик НЕЛЬЗЯ: вход, аккаунт, кабинет, приложение, админка.
// Редиректы (Navigate) и '*' сюда не входят — страницы у них нет.
const PRIVATE = [
  '/admin', '/login', '/auth/callback', '/auth/confirm', '/auth/telegram', '/auth/2fa',
  '/auth/recovery', '/auth/recovery/confirm', '/auth/error', '/link', '/account', '/account/merge',
  '/today', '/diary', '/schemas', '/profile', '/practice', '/cabinet', '/cabinet/:clientId',
];
const REDIRECTS = ['/booking-admin', '/articles-admin', '/help', '/exercises', '*'];

function appRoutePaths(): string[] {
  const src = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
  return [...new Set([...src.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]))];
}
const sample = (path: string) => path.replace(/:[A-Za-z]+/g, 'x');

describe('isPublicMetrikaRoute', () => {
  it.each(['/', '/articles', '/articles/some-slug', '/reviews', '/tests', '/tests/mode-quiz',
    '/subscribe', '/donate', '/privacy', '/offer', '/book', '/booking/paid', '/booking/manage', '/articles/'])(
    '%s — публичный', (p) => expect(isPublicMetrikaRoute(p)).toBe(true));

  it.each(['/today', '/diary', '/cabinet', '/cabinet/42', '/account', '/account/merge', '/login',
    '/auth/callback', '/link', '/admin', '/app/', '/app/today', '/profile', '/practice'])(
    '%s — закрыт', (p) => expect(isPublicMetrikaRoute(p)).toBe(false));

  it('сегментное сравнение: /articles-admin и /booking-admin — не публичные', () => {
    expect(isPublicMetrikaRoute('/articles-admin')).toBe(false);
    expect(isPublicMetrikaRoute('/booking-admin')).toBe(false);
    expect(isPublicMetrikaRoute('/articles/')).toBe(true);
    expect(isPublicMetrikaRoute('/tests/')).toBe(true); // «/tests» с хвостовым слэшем — список тестов
  });
});

describe('сверка с маршрутами App.tsx', () => {
  it('каждый маршрут классифицирован: публичный, закрытый или редирект', () => {
    const unknown = appRoutePaths().filter((p) => {
      if (PRIVATE.includes(p) || REDIRECTS.includes(p)) return false;
      return !isPublicMetrikaRoute(sample(p));
    });
    expect(unknown).toEqual([]);
  });

  it('закрытые маршруты действительно закрыты, а публичные не попали в закрытые', () => {
    for (const p of PRIVATE) expect(isPublicMetrikaRoute(sample(p))).toBe(false);
    const routes = appRoutePaths();
    for (const p of PRIVATE) expect(routes).toContain(p); // протухшая запись тоже красная
  });
});
