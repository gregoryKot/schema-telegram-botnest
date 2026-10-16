import type { AccountProvider } from './ProviderRows';

/**
 * «N из M» в заголовке способов входа. MAX в списке только когда привязан
 * (своей кнопки «Привязать» у него нет), поэтому M — реальное число строк.
 */
export function countMethods(providers: AccountProvider[]): { linked: number; total: number } {
  const has = (id: AccountProvider['provider']) => providers.some((p) => p.provider === id);
  const rows = ['google', 'telegram', 'vk', 'email'] as const;
  const total = rows.length + (has('max') ? 1 : 0);
  const linked = rows.filter(has).length + (has('max') ? 1 : 0);
  return { linked, total };
}

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
