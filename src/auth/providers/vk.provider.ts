import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthProviderHandler, ProviderIdentity } from './types';
import { toVkState } from './vk-state';
import { issueVkPkceVerifier, pkceChallenge } from '../vk-pkce';

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
// PKCE verifier — случайный, в httpOnly-куке шага 1 (vk-pkce.ts, аудит
// 2026-11 S21; раньше — HMAC от state, а state виден в адресе). Шаг 1 — общий
// AuthFlowService.oauthRedirect: issueNonce кладёт куку, buildAuthUrl получает
// verifier вторым аргументом; колбэк (auth-oauth.controller.ts) читает куку.

@Injectable()
export class VkProvider implements AuthProviderHandler {
  readonly id = 'vk';
  readonly displayName = 'ВКонтакте';

  constructor(private readonly config: ConfigService) {}

  issueNonce(res: Response): string {
    return issueVkPkceVerifier(res);
  }

  // verifier — из issueNonce (кука шага 1). Без него PKCE не построить: падать
  // громко, а не выдумывать verifier, которого колбэк не найдёт.
  buildAuthUrl(state: string, verifier?: string): string {
    if (!verifier) throw new Error('VK PKCE: buildAuthUrl без verifier');
    const clientId = this.config.getOrThrow<string>('VK_APP_ID');
    const redirectUri = this.config.getOrThrow<string>('VK_REDIRECT_URI');
    const challenge = pkceChallenge(verifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: toVkState(state),
      code_challenge: challenge,
      code_challenge_method: 's256',
      scope: 'email', // телефон не нужен: минимизация, ч. 5 ст. 5 152-ФЗ
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
    { state, verifier }: { state: string; verifier: string },
  ): Promise<ProviderIdentity> {
    const clientId = this.config.getOrThrow<string>('VK_APP_ID');
    const redirectUri = this.config.getOrThrow<string>('VK_REDIRECT_URI');

    // Token exchange: POST application/x-www-form-urlencoded
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: clientId,
      device_id: deviceId,
      // VK ID ждёт state и в обмене кода — тот, что видел на authorize.
      state: toVkState(state),
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
          user?: { first_name?: string };
        };
        // Открытым в User.firstName — только имя, без фамилии (S16, 2026-11).
        displayName = info.user?.first_name?.trim() || undefined;
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
