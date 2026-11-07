// Общие кирпичи карты мутаций: тип правила и помощники, которыми пишут
// строки в apiCacheRules.data.ts и apiCacheRules.therapy.ts. Отдельный модуль —
// чтобы два файла правил не импортировали друг друга по кругу.
import type { InvalidationTarget } from './apiCache';

export type Body = Record<string, unknown> | undefined;

export interface Rule {
  method: 'POST' | 'DELETE' | 'PATCH';
  pattern: RegExp;
  /** true — мутация меняет учётную запись целиком (напр. удаление аккаунта). */
  clearAll?: true;
  targets?: (match: RegExpMatchArray, body: Body) => InvalidationTarget[];
}

export const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;
export const numStr = (v: unknown): string | undefined =>
  typeof v === 'number' || typeof v === 'string' ? String(v) : undefined;

/** Мутация без зависимости от body/id — фиксированный набор ключей. */
export function simple(
  method: Rule['method'],
  pattern: RegExp,
  ...targets: InvalidationTarget[]
): Rule {
  return { method, pattern, targets: () => targets };
}
