// Владелец локальных данных: чей клинический контент лежит в localStorage.
//
// Аудит 2026-10 (E1). Контент (письма, безопасное место, ответы YSQ, черновики
// дневников, ярлыки схем, очередь оценок) зеркалится в localStorage. Чистился он
// только при выходе. Но аккаунт в контейнере меняется и БЕЗ выхода: привязка
// устройства к другому аккаунту (device-link), вход другим способом поверх
// живого. Тогда текст пользователя A оставался в браузере, а экраны с
// фолбэком «сервер вернул пусто → берём локальную копию» показывали его
// пользователю B и автосохранением ЗАПИСЫВАЛИ в его аккаунт.
//
// Одна защита на оба фронтенда (правило №3): как только в контейнер попадает
// сессия, сверяем её владельца с запомненным. Чужой — чистим всё тем же
// clearLocalData, что и выход. Владелец берётся из `sub` токена: это userId,
// под которым сервер отвечает на запросы (у привязанного устройства он не равен
// id пользователя площадки, поэтому getHost().user() для этого не годится).
import { clearLocalData } from './clearLocalData';
import { markAuthSeen } from './authSeen';
import { readLocal, writeLocal } from '../utils/safeLocalStorage';

export const DATA_OWNER_KEY = 'data_owner_id';

/** userId из `sub` JWT без проверки подписи: подпись проверяет сервер, здесь
 *  нужен лишь ярлык «чьи это данные». Не токен или нет `sub` → null. */
export function tokenSubject(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' || typeof sub === 'number' ? String(sub) : null;
  } catch {
    return null; // битый токен — владельца не знаем, не гадаем
  }
}

/** true — данные прежнего владельца стёрты. Не было владельца или он тот же —
 *  ничего не трогаем (первый запуск не должен стирать то, что уже лежит). */
export function ensureDataOwner(serverUserId: string): boolean {
  if (!serverUserId) return false;
  const stored = readLocal(DATA_OWNER_KEY);
  const changed = !!stored && stored !== serverUserId;
  if (changed) clearLocalData();
  if (stored !== serverUserId) writeLocal(DATA_OWNER_KEY, serverUserId);
  return changed;
}

/** Сокращение для точек, где в контейнер попадает токен сессии. */
export function ensureDataOwnerForToken(token: string): boolean {
  const sub = tokenSubject(token);
  return sub ? ensureDataOwner(sub) : false;
}

/** «Сессия жива» для обоих фронтендов: сначала проверка владельца данных (чужие
 *  стираются, в том числе отметка входа), затем отметка «вход удавался». Порядок
 *  важен — обратный стёр бы только что поставленную отметку. */
export function markSessionStarted(token: string): void {
  ensureDataOwnerForToken(token);
  markAuthSeen();
}
