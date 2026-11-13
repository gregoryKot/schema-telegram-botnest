import type { AccountProvider } from './ProviderRows';

/** Сервисы со своей кнопкой «Привязать»: строка есть всегда, порядок — как на экране входа. */
export const OAUTH_METHODS = ['vk', 'yandex'] as const;
export type OAuthMethod = (typeof OAUTH_METHODS)[number];

/**
 * «N из M» в заголовке способов входа. MAX, Telegram и Google (входа на сайт через два
 * последних нет с 2026-11) — в списке только привязанные, без «Привязать»; M — число строк.
 */
export function countMethods(providers: AccountProvider[]): { linked: number; total: number } {
  const has = (id: AccountProvider['provider']) => providers.some((p) => p.provider === id);
  const rows = [...OAUTH_METHODS, 'email'] as const;
  const extra = (['max', 'telegram', 'google'] as const).filter(has).length;
  return { linked: rows.filter(has).length + extra, total: rows.length + extra };
}

/**
 * Можно ли отвязать способ: после отвязки должен остаться хоть один другой —
 * то же правило, что на сервере (src/auth/unlink-provider.ts). QA 2026-11
 * (М2): «Отвязать» у единственного способа была активна и вела к отказу.
 */
export function canUnlink(providers: AccountProvider[], id: AccountProvider['provider']): boolean {
  return providers.some((p) => p.provider !== id);
}

/** Почему «Отвязать» недоступна — под строкой способа. */
export const ONLY_METHOD_NOTE = 'Единственный способ входа — отвязать можно, когда появится второй';

/** Инициалы для аватара из реальных данных привязок; нет данных — null (аватар не рисуем). */
export function accountInitials(providers: AccountProvider[]): string | null {
  const name = providers.find((p) => p.displayName?.trim())?.displayName?.trim();
  const source = name ?? providers.find((p) => p.email?.trim())?.email?.trim();
  if (!source) return null;
  const words = (name ? source.split(/\s+/) : [source.split('@')[0]]).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w.replace(/^[^\p{L}\p{N}]+/u, ''))[0] ?? '');
  const out = letters.join('').toUpperCase();
  return out || null;
}
