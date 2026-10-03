import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyGoogleIdToken } from './google-id-token';
import { buildGoogleAuthUrl } from './google-auth-url';
import { AuthProviderHandler, ProviderIdentity } from './types';

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

  constructor(private readonly config: ConfigService) {}

  // ── Step 1: ссылка входа — в google-auth-url.ts (её же строит самопроверка).
  buildAuthUrl(state: string, _nonce?: string, forceChooser = false): string {
    return buildGoogleAuthUrl(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      state,
      forceChooser,
    );
  }

  // Origin редиректа Google (GOOGLE_REDIRECT_URI) — на нём обязана жить кука
  // oauth_state, иначе колбэк её не увидит (алиас-домен, разбор 2026-09-08).
  callbackOrigin(): string {
    return new URL(this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'))
      .origin;
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
      } catch (e: unknown) {
        // Сетевой сбой (DNS/TLS/timeout) — пробуем следующий алиас.
        const err = e instanceof Error ? e : new Error(String(e));
        const cause = (err as { cause?: { code?: string; message?: string } })
          .cause;
        const detail = cause
          ? ` | cause: ${cause.code ?? cause.message ?? 'unknown'}`
          : '';
        this.logger.warn(
          `Google token endpoint unreachable (${endpoint}): ${err.message}${detail}`,
        );
        lastNetErr = err;
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
      return this.verifyIdToken(data.id_token);
    }

    this.logger.error(
      `Google token exchange failed: all endpoints unreachable, last: ${lastNetErr?.message}`,
    );
    throw new UnauthorizedException('Google token exchange failed');
  }

  // Проверка id_token (подпись по JWKS + issuer/audience) живёт в
  // google-id-token.ts — там же ветка на случай недостижимого JWKS. Публичный:
  // тем же путём проверяется id_token, пришедший от Google One Tap напрямую в
  // браузер (POST /api/auth/google/one-tap) — те же издатель/получатель/срок и
  // тот же отказ на подделке, что и у обмена кода.
  async verifyIdToken(idToken: string): Promise<ProviderIdentity> {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');

    let claims: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
    try {
      claims = await verifyGoogleIdToken(idToken, clientId);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        `Google id_token JWT verification failed: ${err.message}`,
      );
      throw new UnauthorizedException('Google ID token invalid');
    }

    if (claims.offline) {
      // Видно в логах: вход прошёл, но ключи Google с хоста не скачались.
      this.logger.warn(
        'Google JWKS недостижим — id_token принят по claims (получен от Google по TLS)',
      );
    }

    if (!claims.emailVerified) {
      throw new UnauthorizedException('Google email not verified');
    }

    return {
      providerId: claims.sub,
      email: claims.email,
      displayName: claims.name ?? claims.email,
    };
  }
}
