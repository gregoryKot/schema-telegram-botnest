import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AuthProviderHandler, ProviderIdentity } from './types';

// VK ID (modern OAuth 2.1 + PKCE flow). Docs:
//   https://id.vk.com/about/business/go/docs/en/vkid/latest/vk-id/connection/...
//
// Differs from classic oauth.vk.com (now deprecated) in:
//   - authorize endpoint id.vk.com/authorize
//   - token endpoint id.vk.com/oauth2/auth (POST body, not GET query)
//   - PKCE: code_verifier per request, hashed to code_challenge sent on
//     authorize, verifier sent on token exchange
//   - device_id is returned alongside `code` and must be replayed on exchange
//
// PKCE verifier не хранится — он выводится из state: HMAC(JWT_SECRET, state).
// Раньше он жил в Map в памяти процесса, а на Amvera больше одного инстанса
// (правило №5) и каждый деплой перезапускает процесс: колбэк, попавший на
// другой инстанс или после рестарта, не находил verifier → «VK PKCE verifier
// expired or missing» → /auth/error?reason=vk_failed (инцидент 2026-10-03).
// Секретность verifier держит ключ: state виден в адресе, HMAC без ключа —
// нет. Срок и одноразовость держат кука oauth_state (10 минут, стирается в
// колбэке) и сам VK: code одноразовый и короткоживущий.

@Injectable()
export class VkProvider implements AuthProviderHandler {
  readonly id = 'vk';
  readonly displayName = 'ВКонтакте';

  constructor(private readonly config: ConfigService) {}

  private verifierFor(state: string): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return crypto
      .createHmac('sha256', secret)
      .update(`vk-pkce-verifier:${state}`)
      .digest('base64url');
  }

  buildAuthUrl(state: string): string {
    const clientId = this.config.getOrThrow<string>('VK_APP_ID');
    const redirectUri = this.config.getOrThrow<string>('VK_REDIRECT_URI');

    // PKCE S256: verifier (43 символа base64url) → sha256 → base64url.
    const challenge = crypto
      .createHash('sha256')
      .update(this.verifierFor(state))
      .digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 's256',
      scope: 'email phone',
    });
    return `https://id.vk.com/authorize?${params}`;
  }

  // Origin редиректа VK (VK_REDIRECT_URI) — на нём обязана жить кука
  // oauth_state, иначе колбэк её не увидит (алиас-домен, разбор 2026-09-08).
  callbackOrigin(): string {
    return new URL(this.config.getOrThrow<string>('VK_REDIRECT_URI')).origin;
  }

  // VK ID returns `code`, `state`, AND `device_id` on the callback URL.
  // Our generic OAuth handler in auth.controller only forwards `code` and
  // `state` — we read `device_id` separately. To keep the handler signature
  // clean we accept `code` as a JSON envelope when needed.
  //
  // Simplification: VK puts device_id as a query param. We read it from the
  // current request URL via a side channel — see exchangeCodeWithRequest below.
  exchangeCode(): Promise<ProviderIdentity> {
    // This signature is kept for type compatibility but VK needs device_id +
    // state. Use exchangeCodeWithContext via the OAuth callback wrapper.
    throw new Error(
      'VkProvider.exchangeCode requires context — call exchangeCodeWithContext()',
    );
  }

  async exchangeCodeWithContext(
    code: string,
    deviceId: string,
    state: string,
  ): Promise<ProviderIdentity> {
    const clientId = this.config.getOrThrow<string>('VK_APP_ID');
    const redirectUri = this.config.getOrThrow<string>('VK_REDIRECT_URI');

    // Token exchange: POST application/x-www-form-urlencoded
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: this.verifierFor(state),
      redirect_uri: redirectUri,
      client_id: clientId,
      device_id: deviceId,
    });
    const tokenRes = await fetch('https://id.vk.com/oauth2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      user_id?: number;
      email?: string;
      error?: string;
      error_description?: string;
    };
    if (
      !tokenRes.ok ||
      tokenData.error ||
      !tokenData.access_token ||
      !tokenData.user_id
    ) {
      throw new UnauthorizedException(
        `VK auth error: ${tokenData.error_description ?? tokenData.error ?? 'unknown'}`,
      );
    }

    // Fetch user info — VK ID exposes user_info under oauth2/user_info
    let displayName: string | undefined;
    try {
      const infoRes = await fetch('https://id.vk.com/oauth2/user_info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: tokenData.access_token,
          client_id: clientId,
        }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
      if (infoRes.ok) {
        const info = (await infoRes.json()) as {
          user?: { first_name?: string; last_name?: string };
        };
        const u = info.user;
        if (u)
          displayName =
            [u.first_name, u.last_name].filter(Boolean).join(' ') || undefined;
      }
    } catch {
      /* non-fatal */
    }

    return {
      providerId: String(tokenData.user_id),
      email: tokenData.email,
      displayName,
    };
  }
}
