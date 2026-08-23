// Движок применения карты мутаций (данные — apiCacheRules.data.ts, правило
// №10 CLAUDE.md: список правил не растит движок, гейт размера файла не видит
// одну раздутую сущность).
import { invalidate, clearApiCache } from './apiCache';
import { RULES } from './apiCacheRules.data';

function parseBody(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Вызывается после КАЖДОГО успешного (res.ok) не-GET запроса (apiClient.ts
 *  обоих фронтендов) — единая точка входа для инвалидации. */
export function applyMutationInvalidation(
  method: string | undefined,
  path: string,
  rawBody: unknown,
): void {
  const m = (method ?? 'GET').toUpperCase();
  if (m !== 'POST' && m !== 'DELETE' && m !== 'PATCH') return;
  const pathname = path.split('?')[0];
  const body = parseBody(rawBody);
  for (const rule of RULES) {
    if (rule.method !== m) continue;
    const match = pathname.match(rule.pattern);
    if (!match) continue;
    if (rule.clearAll) {
      clearApiCache();
      return;
    }
    invalidate(rule.targets?.(match, body) ?? []);
  }
}
