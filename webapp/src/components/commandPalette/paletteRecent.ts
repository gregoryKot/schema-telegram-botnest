// «Недавнее» общего поиска: ключи последних открытых строк (тип + id — без имён и без текста запроса).
// Единственный писатель ключа search_recent (scripts/local-cache-baseline.json), запись — через
// safeLocalStorage; при выходе стирается вместе со всем хранилищем (clearLocalData).
import { readLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';

const KEY = 'search_recent';
export const RECENT_LIMIT = 5;

/** Ключи строк, свежие первыми; битый JSON или недоступное хранилище — пусто. */
export function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(readLocal(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === 'string').slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/** Открытая строка встаёт первой; повтор поднимается наверх, лишнее уходит с конца. */
export function pushRecent(key: string): void {
  writeLocal(KEY, JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, RECENT_LIMIT)));
}
