import type { AccountProvider } from './ProviderRows';
import { telegramChatUrl } from '../../../../shared/src/utils/therapistContact';

/** Сервисы со своей кнопкой «Привязать»: строка есть всегда, порядок — как на экране входа. */
export const OAUTH_METHODS = ['vk', 'yandex'] as const;
export type OAuthMethod = (typeof OAUTH_METHODS)[number];

/**
 * «N из M» в заголовке способов входа. MAX, Telegram и Google (входа на сайт через два
 * последних нет с 2026-11) — в списке только привязанные, без «Привязать»; M — число строк.
 * Почта — не способ входа: её строка в своей группе «Почта для писем».
 */
export function countMethods(providers: AccountProvider[]): { linked: number; total: number } {
  const has = (id: AccountProvider['provider']) => providers.some((p) => p.provider === id);
  const extra = (['max', 'telegram', 'google'] as const).filter(has).length;
  return { linked: OAUTH_METHODS.filter(has).length + extra, total: OAUTH_METHODS.length + extra };
}

/**
 * Чем входят в аккаунт: VK ID и Яндекс ID — на сайте, Telegram и MAX — внутри
 * мессенджера. Почта (вход отключён, ч. 10 ст. 8 149-ФЗ) и Google входом не
 * считаются. Копия списка — на сервере (src/auth/unlink-provider.ts), сверка —
 * accountMethods.test.ts (правило №4).
 */
export const LOGIN_PROVIDERS: readonly AccountProvider['provider'][] = ['vk', 'yandex', 'telegram', 'max'];

/**
 * Можно ли отвязать способ: после отвязки должен остаться вход — строка из
 * LOGIN_PROVIDERS или номер аккаунта из Telegram (он входит через бота и без
 * строки). То же правило, что на сервере (src/auth/unlink-provider.ts).
 * QA 2026-11 (М2): «Отвязать» у единственного способа была активна и вела к отказу.
 */
export function canUnlink(providers: AccountProvider[], id: AccountProvider['provider'], userId: string | null): boolean {
  // Номер сам — адрес в Telegram (граница — WEB_USER_ID_MIN, сверена с сервером).
  if (userId !== null && telegramChatUrl(userId) !== null) return true;
  // Отвязка уносит все строки провайдера (как deleteMany на сервере).
  return providers.some((p) => p.provider !== id && LOGIN_PROVIDERS.includes(p.provider));
}

/** Почему «Отвязать» недоступна — под строкой способа; можно отвязать — null. */
export function unlinkBlockedWhy(providers: AccountProvider[], id: AccountProvider['provider'], userId: string | null): string | null {
  if (canUnlink(providers, id, userId)) return null;
  const other = id === 'vk' ? 'Яндекс ID' : id === 'yandex' ? 'VK ID' : 'VK ID или Яндекс ID';
  return `Другого входа в аккаунт нет — отвязать можно, когда привязан ${other}`;
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
