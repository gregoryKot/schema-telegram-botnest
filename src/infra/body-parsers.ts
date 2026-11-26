// Парсеры тела запроса — одно место на bootstrap, тестовые приложения
// (test/e2e-support/*) зовут ту же функцию, а не копируют строки main.ts
// (правило «одна механика — один компонент»).
//
// JSON разбирается везде. HTML-форма (`application/x-www-form-urlencoded`) —
// только на путях из FORM_BODY_PATHS: это единственные ручки, куда форму шлёт
// внешняя система. Глобальный urlencoded-парсер делал из любого POST
// «простой» кросс-сайтовый запрос, который проходит без preflight:
// форма с чужого сайта попадала в DTO и в обработчик (login-CSRF, аудит
// 2026-10-11, security#6: refresh-кука сессии атакующего ставилась жертве).
// Без парсера форма даёт пустое тело, и DTO отвечает 400.
//
// Новый путь сюда — только если форму шлёт внешняя система, которая JSON не
// умеет (Robokassa ResultURL), и ручка не опирается на куки.
import { json, urlencoded } from 'express';
import { BODY_LIMIT } from './body-limit';

export const FORM_BODY_PATHS: readonly string[] = ['/api/payment/result'];

/** Минимум от Nest-приложения, нужный установщику (подходит и для express). */
export interface UseTarget {
  use(...args: unknown[]): unknown;
}

export function installBodyParsers(app: UseTarget): void {
  app.use(json({ limit: BODY_LIMIT }));
  for (const path of FORM_BODY_PATHS) {
    app.use(path, urlencoded({ limit: BODY_LIMIT, extended: true }));
  }
}
