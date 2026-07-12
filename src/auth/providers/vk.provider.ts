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
// PKCE verifiers are kept in a short-lived in-memory map keyed by state.
// 10-min TTL — matches the state-cookie expiry. Works on a single instance;
// for horizontal scaling move into Redis or sign-in-cookie.
@Injectable()
export class VkProvider implements AuthProviderHandler {
  readonly id = 'vk';
  readonly displayName = 'ВКонтакте';

  private readonly verifiers = new Map<
    string,
    { verifier: string; expiresAt: number }
  >();

  constructor(private readonly config: ConfigService) {
    // Sweep expired verifiers every 15 min so the map doesn't grow unboundedly
    // on sustained traffic where buildAuthUrl is never paired with a callback.
    setInterval(() => this.prune(), 15 * 60_000).unref();
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.verifiers)
      if (v.expiresAt < now) this.verifiers.delete(k);
  }

  buildAuthUrl(state: string): string {
    this.prune();
    const clientId = this.config.getOrThrow<string>('VK_APP_ID');
    const redirectUri = this.config.getOrThrow<string>('VK_REDIRECT_URI');

    // PKCE: 64-byte verifier → base64url-encoded → sha256 → base64url(challenge)
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    this.verifiers.set(state, {
      verifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

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

  // VK ID returns `code`, `state`, AND `device_id` on the callback URL.
  // Our generic OAuth handler in auth.controller only forwards `code` and
  // `state` — we read `device_id` separately. To keep the handler signature
  // clean we accept `code` as a JSON envelope when needed.
  //
  // Simplification: VK puts device_id as a query param. We read it from the
  // current request URL via a side channel — see exchangeCodeWithRequest below.
  async exchangeCode(code: string): Promise<ProviderIdentity> {
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
    const entry = this.verifiers.get(state);
    this.verifiers.delete(state);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('VK PKCE verifier expired or missing');
    }

    // Token exchange: POST application/x-www-form-urlencoded
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: entry.verifier,
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
