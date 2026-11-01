// Человеческие имена способов входа — одно место для сайта: диалог отвязки в
// /account, экран объединения аккаунтов (/account/merge) и подтверждение
// привязки из мессенджера (/link). Раньше было три словаря, а /account/merge
// показывал технический id провайдера из адреса («Аккаунт google»).
// Бэкенд кладёт в адрес id в нижнем регистре (`src/auth/auth-flow.service.ts`,
// `finishOAuthRedirect`): google, vk, telegram, max.
import type { ProviderId } from './ProviderRows';

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  google: 'Google',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  max: 'MAX',
  email: 'Email',
};

/** Имя провайдера для текста; неизвестный id — `null`, а не сам id. */
export function providerName(id: string | null | undefined): string | null {
  if (!id) return null;
  return Object.prototype.hasOwnProperty.call(PROVIDER_NAMES, id)
    ? PROVIDER_NAMES[id as ProviderId]
    : null;
}
