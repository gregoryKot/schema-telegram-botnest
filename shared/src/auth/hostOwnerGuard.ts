// Владелец локальных данных, определённый по ПЛОЩАДКЕ, а не по токену.
//
// Аудит 2026-10, E-1, путь мини-аппа. dataOwnerGuard сверяет владельца по `sub`
// токена, то есть только после обмена подписи на сессию. До обмена приложение
// уже стартует на чужих данных: `therapist_mode` читается в useState, экраны
// берут локальные копии. Telegram же сообщает, кто открыл приложение, сразу
// (initDataUnsafe.user) — запоминаем этот id и сверяем его до первого рендера.
//
// Сравниваются id площадки с id площадки, а не с `sub`: у привязанного
// устройства (device-link) `sub` не равен id пользователя площадки, но сам id
// площадки у такого устройства стабилен — ложного стирания не будет. Веб-хост
// без user() и первый запуск после деплоя (записи нет) — ничего не трогаем:
// авторитетной остаётся сверка по токену.
import { getHost } from '../host';
import { clearLocalData } from './clearLocalData';
import { markSessionStarted } from './dataOwnerGuard';
import { readLocal, writeLocal } from '../utils/safeLocalStorage';

export const HOST_OWNER_KEY = 'data_owner_host';

/** id пользователя площадки с префиксом площадки; null — хост не знает, кто. */
function hostOwnerId(): string | null {
  const host = getHost();
  const id = host.user()?.id;
  return id ? `${host.id}:${id}` : null;
}

/** Запомнить, чьи данные лежат в браузере (id площадки). */
export function rememberHostOwner(): void {
  const owner = hostOwnerId();
  if (owner) writeLocal(HOST_OWNER_KEY, owner);
}

/** Звать ДО первого рендера. true — данные прежнего владельца площадки стёрты. */
export function ensureHostOwner(): boolean {
  const owner = hostOwnerId();
  const stored = readLocal(HOST_OWNER_KEY);
  if (!owner || !stored || stored === owner) return false;
  clearLocalData();
  writeLocal(HOST_OWNER_KEY, owner);
  return true;
}

/** markSessionStarted + запись владельца площадки. Порядок важен: сверка по
 *  токену может стереть всё, и запись должна лечь уже после неё. */
export function markHostSessionStarted(token: string): void {
  markSessionStarted(token);
  rememberHostOwner();
}
