import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthProviderHandler, ProviderIdentity } from './types';

// Google's public keys (JWKS). jose caches internally and re-fetches on cache miss.
// Fetched lazily on first verifyIdToken call — no outbound request at startup.
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

@Injectable()
export class GoogleProvider implements AuthProviderHandler {
  readonly id = 'google';
  readonly displayName = 'Google';
  private readonly logger = new Logger(GoogleProvider.name);

  // Lazily created so the module initialises even if the fetch would fail.
  private _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private get jwks() {
    if (!this._jwks) this._jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));
    return this._jwks;
  }

  constructor(private readonly config: ConfigService) {}

  // ── Step 1: build redirect URL ────────────────────────────────────────────
  // Uses response_type=id_token + response_mode=form_post so Google POSTs
  // the id_token directly to our callback — no server→Google network call needed.
  buildAuthUrl(state: string, nonce?: string): string {
    const clientId    = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'id_token',
      response_mode: 'form_post',
      scope:         'openid email profile',
      state,
      nonce:         nonce ?? 'nonce',
      prompt:        'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // ── Step 2: verify id_token locally via JWKS (no outbound API call) ───────
  async verifyIdToken(idToken: string, expectedNonce: string): Promise<ProviderIdentity> {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(idToken, this.jwks, {
        issuer:   ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      }));
    } catch (e: any) {
      this.logger.error(`Google id_token JWT verification failed: ${e.message}`);
      throw new UnauthorizedException('Google ID token invalid');
    }

    if (payload['nonce'] !== expectedNonce) {
      this.logger.warn('Google id_token nonce mismatch');
      throw new UnauthorizedException('Google ID token nonce mismatch');
    }
    if (payload['email_verified'] !== true) {
      throw new UnauthorizedException('Google email not verified');
    }

    return {
      providerId:  payload.sub!,
      email:       payload['email'] as string,
      displayName: (payload['name'] as string | undefined) ?? (payload['email'] as string),
    };
  }
}
