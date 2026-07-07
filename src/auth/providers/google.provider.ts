import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthProviderHandler, ProviderIdentity } from './types';

// Google's public keys (JWKS). jose caches internally and re-fetches on cache miss.
// Fetched lazily on first token verification — no outbound request at startup.
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

// Token endpoint + его легаси-алиасы на других доменах. С хостинга (Amvera)
// oauth2.googleapis.com может быть недостижим на сетевом уровне («fetch
// failed»), при этом www.googleapis.com доступен — JWKS исторически ходил
// именно туда. Пробуем по очереди; HTTP-ответ с ошибкой от Google — финален,
// fallback только при сетевых сбоях.
const GOOGLE_TOKEN_URIS = [
  'https://oauth2.googleapis.com/token',
  'https://www.googleapis.com/oauth2/v4/token',
  'https://accounts.google.com/o/oauth2/token',
];

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

  // ── Step 1: build redirect URL (OAuth 2.0 Authorization Code flow) ────────
  // response_type=code → Google redirects back to GOOGLE_REDIRECT_URI with
  // ?code=&state= via a top-level GET. We exchange the code server-side.
  // (The legacy implicit flow — response_type=id_token + response_mode=form_post
  // — is deprecated and relied on a SameSite=None cookie that third-party-cookie
  // phase-out breaks, so we no longer use it.)
  buildAuthUrl(state: string): string {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // ── Step 2: exchange the code for tokens, then verify the id_token ────────
  async exchangeCode(code: string): Promise<ProviderIdentity> {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    let lastNetErr: Error | null = null;
    for (const endpoint of GOOGLE_TOKEN_URIS) {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (e: any) {
        // Сетевой сбой (DNS/TLS/timeout) — пробуем следующий алиас.
        const cause = e?.cause;
        const detail = cause
          ? ` | cause: ${cause.code ?? cause.message ?? cause}`
          : '';
        this.logger.warn(
          `Google token endpoint unreachable (${endpoint}): ${e.message}${detail}`,
        );
        lastNetErr = e;
        continue;
      }

      const data = (await res.json().catch(() => ({}))) as {
        id_token?: string;
        error?: string;
        error_description?: string;
      };
      if (!res.ok || data.error || !data.id_token) {
        // HTTP-ответ получен — это вердикт Google, fallback не поможет.
        this.logger.error(
          `Google token exchange rejected (${endpoint}): ${data.error_description ?? data.error ?? `HTTP ${res.status}`}`,
        );
        throw new UnauthorizedException('Google token exchange failed');
      }
      return this.decodeIdentity(data.id_token);
    }

    this.logger.error(
      `Google token exchange failed: all endpoints unreachable, last: ${lastNetErr?.message}`,
    );
    throw new UnauthorizedException('Google token exchange failed');
  }

  // Verify id_token signature + claims via Google's JWKS. The token comes
  // straight from Google's token endpoint over TLS; verifying the signature is
  // defence-in-depth and also pins issuer/audience.
  private async decodeIdentity(idToken: string): Promise<ProviderIdentity> {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(idToken, this.jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      }));
    } catch (e: any) {
      this.logger.error(
        `Google id_token JWT verification failed: ${e.message}`,
      );
      throw new UnauthorizedException('Google ID token invalid');
    }

    if (payload['email_verified'] !== true) {
      throw new UnauthorizedException('Google email not verified');
    }

    return {
      providerId: payload.sub!,
      email: payload['email'] as string,
      displayName:
        (payload['name'] as string | undefined) ?? (payload['email'] as string),
    };
  }
}
