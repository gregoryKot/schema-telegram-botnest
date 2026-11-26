import type { NextFunction, Request, Response } from 'express';

// Ответы /api/* не оседают в HTTP-кэше браузера (аудит 2026-11, P2).
//
// Зачем: ручки /api отдают расшифрованные дневники, заметки и полный экспорт
// аккаунта (account-export.controller.ts). Без Cache-Control браузер вправе
// положить ответ в дисковый кэш (Express ставит weak ETag), и текст лежит на
// диске открытым после выхода: clearLocalData чистит localStorage, а не кэш.
// Поэтому по умолчанию `no-store`. Заголовок ставится ДО хендлера: ручка, которой
// кэш нужен, перезаписывает его своим (`res.set`, `@Header`) — её решение главнее.
//
// Выход (POST /api/auth/logout) дополнительно просит браузер стереть HTTP-кэш
// сайта (`Clear-Site-Data: "cache"`): там могли остаться ответы, записанные до
// этого заголовка или ручками со своим Cache-Control. Путь сверяется с маршрутом
// AuthController в api-no-store.spec.ts — переименование ручки краснеет там.

export const API_NO_STORE = 'no-store';
export const LOGOUT_PATH = '/api/auth/logout';

const isApi = (path: string): boolean =>
  path === '/api' || path.startsWith('/api/');

export function apiNoStore(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Express сверяет маршруты без учёта регистра и хвостового «/» — так же и здесь.
  const path = req.path.toLowerCase().replace(/(.)\/+$/, '$1');
  if (isApi(path)) {
    if (!res.getHeader('Cache-Control'))
      res.setHeader('Cache-Control', API_NO_STORE);
    if (req.method === 'POST' && path === LOGOUT_PATH)
      res.setHeader('Clear-Site-Data', '"cache"');
  }
  next();
}
