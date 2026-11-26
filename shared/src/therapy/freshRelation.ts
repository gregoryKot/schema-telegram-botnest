import { invalidate } from '../api/apiCache';

// «Мой терапевт» при открытии настроек — связь с сервера, а не из кеша
// вкладки. QA 2026-11 (М4): страница открыта, человек подключился к терапевту
// на другом устройстве, а «Настройки → Мой терапевт» показывали поле для кода
// и давали подключиться ещё раз — GET отдавался из кеша (stale-while-
// revalidate, apiCache.ts) и фоновое обновление экрану уже не доходило.

export const THERAPY_RELATION_PATH = '/api/therapy/relation';

/** Перечитать связь мимо кеша: сброс ключа и обычный запрос. */
export function loadFreshTherapyRelation<T>(get: () => Promise<T>): Promise<T> {
  invalidate([THERAPY_RELATION_PATH]);
  return get();
}
