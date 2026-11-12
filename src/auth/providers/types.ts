import type { Response } from 'express';

// Identity returned by any provider after successful verification.
export interface ProviderIdentity {
  providerId: string; // unique within the provider (telegramId, googleSub, vkId, …)
  email?: string;
  displayName?: string; // ляжет открытым в User.firstName — только имя (S16)
}

// Single abstraction for auth providers: an OAuth pair (buildAuthUrl +
// exchangeCode) for redirect-based flows. Провайдер без них (Telegram, MAX) —
// только имя способа входа: его подпись проверяется внутри мессенджера.
export interface AuthProviderHandler {
  readonly id: string; // 'google' | 'telegram' | 'vk' | …
  readonly displayName: string;
  // OAuth-redirect flow: buildAuthUrl → provider redirects back with a code →
  // exchangeCode swaps it for the user's identity (server-side token exchange).
  // forceChooser — only for account-LINKING: force the account picker so the
  // user picks WHICH account to attach; LOGIN lets a signed-in user bounce
  // straight back. nonce — секрет шага 1 из issueNonce, если он объявлен:
  // провайдер кладёт его в куку через oauth-host.ts (PKCE-верификатор VK).
  buildAuthUrl?(state: string, nonce?: string, forceChooser?: boolean): string;
  issueNonce?(res: Response): string;
  exchangeCode?(code: string): Promise<ProviderIdentity>;
  // Origin, на который провайдер возвращает пользователя (redirect_uri). Кука
  // oauth_state обязана жить на ЭТОМ хосте — иначе колбэк её не увидит.
  callbackOrigin?(): string;
}

export type ProviderRegistry = Map<string, AuthProviderHandler>;
