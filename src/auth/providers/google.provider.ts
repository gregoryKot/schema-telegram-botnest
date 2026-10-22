import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyGoogleIdToken } from './google-id-token';
import { buildGoogleAuthUrl } from './google-auth-url';
import { AuthProviderHandler, ProviderIdentity } from './types';
import { assertOneTapNonce } from '../google-one-tap-nonce';

// Token endpoint + легаси-алиасы: с Amvera oauth2.googleapis.com бывает
// недостижим, www.googleapis.com — доступен. Пробуем по очереди; HTTP-ответ с
// ошибкой — финален, fallback только при сетевых сбоях.
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

  // Проверка id_token — в google-id-token.ts. Публичный: так же проверяется
  // токен One Tap; `oneTap` — его прислал браузер: нужен nonce из куки, офлайн-
  // путь запрещён (google-one-tap-nonce.ts).
  async verifyIdToken(
    idToken: string,
    oneTap?: { nonceCookie: string | undefined },
  ): Promise<ProviderIdentity> {
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

    if (oneTap) assertOneTapNonce(claims, oneTap.nonceCookie);
    if (claims.offline) {
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
