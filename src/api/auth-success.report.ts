// Тихая половина входа получает голос — dual к auth-failure.report.ts
// (инцидент 2026-08-08, «Успешный вход не считается» в docs/SHIELD_PROMPT.md).
//
// Зачем нужен именно счётчик УСПЕХОВ, а не только отказов. Рост auth_rejected
// виден, только если клиент ДОХОДИТ до guard'а и получает внятный отказ. Если
// клиент вообще не доезжает до сервера (сломанный бандл, DNS, вебвью, упавшее
// до первого запроса) — не пишется ни отказ, ни успех, оба счётчика молчат.
// Единственный способ заметить это с сервера — увидеть, что успехи ПРОСЕЛИ
// относительно обычного уровня, а не что отказы выросли. Отсюда пара.
//
// Троттлинг — тем же примитивом, что у отказов (AlertThrottle,
// src/utils/alert-throttle.ts, правило «одна механика — один компонент»):
// guard проверяет initData/JWT на КАЖДЫЙ запрос экрана мини-аппа (тот же
// повод, что у EVENT_THROTTLE в auth-failure.report.ts — одно открытие
// экрана шлёт полтора десятка запросов), а считать нужно СЕССИИ входа, не
// запросы. Ключ — площадка+userId (верифицированная идентичность, правило
// №5: троттлинг по проверенному sub, не по IP), окно — те же 5 минут, что у
// EVENT_THROTTLE: одна сессия в окне даёт одну строку, а день/неделя
// остаются сопоставимы с блоком отказов в /stats, который считает в тех же
// окнах.
import { AlertThrottle } from '../utils/alert-throttle';

export type AuthSuccessHost = 'telegram' | 'max' | 'web';

const SUCCESS_THROTTLE = new AlertThrottle(5 * 60_000);

export interface AuthSuccessSinks {
  /** Запись события. Отвязана от AnalyticsService, чтобы модуль тестировался
   *  без Nest-обвязки — тот же приём, что и в auth-failure.report.ts. */
  track: (meta: { host: AuthSuccessHost }) => void;
  now?: number;
}

/**
 * Вызывается ПОСЛЕ того, как guard подтвердил личность (JWT/Telegram/MAX
 * initData), перед `return true`. userId нужен только как ключ троттлинга —
 * в БД он не попадает: track() пишет userId = null, тем же приёмом, что и
 * reportAuthFailure. Иначе авторизованный клиент мог бы накрутить отчёт
 * «здоровье входа» повторными успешными запросами со своим userId.
 */
export function reportAuthSuccess(
  userId: bigint,
  host: AuthSuccessHost,
  sinks: AuthSuccessSinks,
): void {
  const now = sinks.now ?? Date.now();
  const decision = SUCCESS_THROTTLE.take(`${host}|${userId}`, now);
  if (decision.allow) sinks.track({ host });
}
