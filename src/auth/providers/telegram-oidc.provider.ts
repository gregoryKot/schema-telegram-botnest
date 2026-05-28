import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { AuthProviderHandler, ProviderIdentity } from './types';

// Telegram OIDC (new flow, replaces legacy widget).
// Docs: https://core.telegram.org/bots/telegram-login
//
// Flow:
//   1. buildAuthUrl()  → redirect to oauth.telegram.org/auth with PKCE
//   2. Telegram redirects back with ?code=...
//   3. exchangeCodePkce() → POST oauth.telegram.org/token → access_token
//   4. GET oauth.telegram.org/userinfo → { sub, name, username }
//
// No server secrets needed — PKCE replaces client_secret.

@Injectable()
export class TelegramOidcProvider implements AuthProviderHandler {
  readonly id = 'telegram-oidc';
  readonly displayName = 'Telegram';
  private readonly logger = new Logger(TelegramOidcProvider.name);
  private readonly botId: string;

  constructor(private readonly config: ConfigService) {
    // BOT_TOKEN format: "<bot_id>:<secret>"
    this.botId = config.getOrThrow<string>('BOT_TOKEN').split(':')[0];
  }

  private get redirectUri(): string {
    const base = this.config.getOrThrow<string>('WEBAPP_URL').replace(/\/$/, '');
    return `${base}/api/auth/telegram-oidc/callback`;
  }

  // ── PKCE helpers ─────────────────────────────────────────────────────────────
  generatePkce(): { verifier: string; challenge: string } {
    const verifier  = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  // ── Step 1 ───────────────────────────────────────────────────────────────────
  buildAuthUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id:             this.botId,
      redirect_uri:          this.redirectUri,
      response_type:         'code',
      scope:                 'openid profile',
      state,
      code_challenge:        codeChallenge ?? '',
      code_challenge_method: 'S256',
    });
    return `https://oauth.telegram.org/auth?${params}`;
  }

  // ── Step 3+4 — called from the controller after the redirect ─────────────────
  async exchangeCodePkce(code: string, codeVerifier: string): Promise<ProviderIdentity> {
    // --- Token exchange ---
    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://oauth.telegram.org/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  this.redirectUri,
          client_id:     this.botId,
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e: any) {
      this.logger.error(`Telegram OIDC token fetch error: ${e?.message} | cause: ${String(e?.cause)}`);
      throw new UnauthorizedException('Telegram OIDC token exchange network error');
    }

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '');
      this.logger.warn(`Telegram OIDC token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`);
      throw new UnauthorizedException('Telegram OIDC token exchange failed');
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // --- Userinfo ---
    let userRes: Response;
    try {
      userRes = await fetch('https://oauth.telegram.org/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
        signal:  AbortSignal.timeout(10_000),
      });
    } catch (e: any) {
      this.logger.error(`Telegram OIDC userinfo fetch error: ${e?.message} | cause: ${String(e?.cause)}`);
      throw new UnauthorizedException('Telegram OIDC userinfo network error');
    }

    if (!userRes.ok) {
      const body = await userRes.text().catch(() => '');
      this.logger.warn(`Telegram OIDC userinfo failed (${userRes.status}): ${body.slice(0, 200)}`);
      throw new UnauthorizedException('Telegram OIDC userinfo failed');
    }

    const user = await userRes.json() as {
      sub: string; name?: string; given_name?: string;
      family_name?: string; username?: string;
    };

    const displayName =
      user.name
      || [user.given_name, user.family_name].filter(Boolean).join(' ')
      || user.username
      || `tg_${user.sub}`;

    return { providerId: user.sub, displayName };
  }
}
