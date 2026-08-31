// Identity returned by any provider after successful verification.
export interface ProviderIdentity {
  providerId: string; // unique within the provider (telegramId, googleSub, vkId, …)
  email?: string;
  displayName?: string;
}

// Single abstraction for auth providers. Implement either an OAuth pair
// (buildAuthUrl + exchangeCode) for redirect-based flows, or
// verifyClientData for client-signed payloads (Telegram widget, Apple JWT, …).
export interface AuthProviderHandler {
  readonly id: string; // 'google' | 'telegram' | 'vk' | …
  readonly displayName: string;

  // OAuth-redirect flow: buildAuthUrl → provider redirects back with a code →
  // exchangeCode swaps it for the user's identity (server-side token exchange).
  // forceChooser: only for account-LINKING (attaching a second identity) —
  // force the provider's account picker so the user explicitly picks WHICH
  // account to attach. Omitted/false for LOGIN, so a provider that recognizes
  // an already-signed-in user bounces them straight back (no "from scratch"
  // re-pick). Providers that don't distinguish may ignore it.
  buildAuthUrl?(state: string, nonce?: string, forceChooser?: boolean): string;
  exchangeCode?(code: string): Promise<ProviderIdentity>;

  // Direct client-data verification (no redirect)
  verifyClientData?(data: Record<string, unknown>): ProviderIdentity;
}

export type ProviderRegistry = Map<string, AuthProviderHandler>;
