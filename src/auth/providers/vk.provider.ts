import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderHandler, ProviderIdentity } from './types';

// VK OAuth 2.0 (classic flow, oauth.vk.com).
// Docs: https://dev.vk.com/api/access-token/authcode-flow-user
@Injectable()
export class VkProvider implements AuthProviderHandler {
  readonly id = 'vk';
  readonly displayName = 'ВКонтакте';

  constructor(private readonly config: ConfigService) {}

  buildAuthUrl(state: string): string {
    const clientId    = this.config.getOrThrow<string>('VK_APP_ID');
    const redirectUri = this.config.getOrThrow<string>('VK_REDIRECT_URI');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      display: 'page',
      scope: 'email',
      response_type: 'code',
      v: '5.131',
      state,
    });
    return `https://oauth.vk.com/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<ProviderIdentity> {
    const clientId     = this.config.getOrThrow<string>('VK_APP_ID');
    const clientSecret = this.config.getOrThrow<string>('VK_APP_SECRET');
    const redirectUri  = this.config.getOrThrow<string>('VK_REDIRECT_URI');

    // Step 1: exchange code → access_token + user_id (+ email if scope granted)
    const tokenUrl = `https://oauth.vk.com/access_token?` + new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) throw new UnauthorizedException('VK token exchange failed');
    const tokenData = await tokenRes.json() as {
      access_token?: string; user_id?: number; email?: string;
      error?: string; error_description?: string;
    };
    if (tokenData.error || !tokenData.access_token || !tokenData.user_id) {
      throw new UnauthorizedException(`VK auth error: ${tokenData.error_description ?? tokenData.error ?? 'unknown'}`);
    }

    // Step 2: fetch display name (optional, just nicer UX).
    let displayName: string | undefined;
    try {
      const infoUrl = `https://api.vk.com/method/users.get?` + new URLSearchParams({
        user_ids: String(tokenData.user_id),
        access_token: tokenData.access_token,
        v: '5.131',
      });
      const infoRes = await fetch(infoUrl);
      if (infoRes.ok) {
        const info = await infoRes.json() as { response?: Array<{ first_name?: string; last_name?: string }> };
        const u = info.response?.[0];
        if (u) displayName = [u.first_name, u.last_name].filter(Boolean).join(' ');
      }
    } catch { /* non-fatal */ }

    return {
      providerId: String(tokenData.user_id),
      email: tokenData.email,
      displayName,
    };
  }
}
