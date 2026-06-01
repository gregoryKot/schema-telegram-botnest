// Identity returned by any provider after successful verification.
export interface ProviderIdentity {
  providerId: string;        // unique within the provider (telegramId, googleSub, vkId, …)
  email?: string;
  displayName?: string;
}

// Single abstraction for auth providers. Implement either an OAuth pair
// (buildAuthUrl + exchangeCode) for redirect-based flows, or
// verifyClientData for client-signed payloads (Telegram widget, Apple JWT, …).
export interface AuthProviderHandler {
  readonly id: string;        // 'google' | 'telegram' | 'vk' | …
  readonly displayName: string;

  // OAuth-redirect flow
  buildAuthUrl?(state: string, nonce?: string): string;
  exchangeCode?(code: string): Promise<ProviderIdentity>;
  // Implicit / form_post flow: verify id_token locally without calling the provider
  verifyIdToken?(idToken: string, nonce: string): Promise<ProviderIdentity>;

  // Direct client-data verification (no redirect)
  verifyClientData?(data: Record<string, unknown>): ProviderIdentity;
}

export type ProviderRegistry = Map<string, AuthProviderHandler>;
