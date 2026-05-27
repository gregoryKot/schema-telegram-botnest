import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderHandler, ProviderIdentity } from './types';

@Injectable()
export class GoogleProvider implements AuthProviderHandler {
  readonly id = 'google';
  readonly displayName = 'Google';
  private readonly logger = new Logger(GoogleProvider.name);

  constructor(private readonly config: ConfigService) {}

  buildAuthUrl(state: string): string {
    const clientId    = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
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

  async exchangeCode(code: string): Promise<ProviderIdentity> {
    const clientId     = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri  = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');

    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri, grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e: any) {
      this.logger.error(`Google token fetch network error: ${e?.message} | cause: ${String(e?.cause)}`);
      throw new UnauthorizedException('Google token exchange network error');
    }
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '');
      this.logger.warn(`Google token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`);
      throw new UnauthorizedException('Google token exchange failed');
    }
    const { id_token } = await tokenRes.json() as { id_token: string };

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!verifyRes.ok) {
      const body = await verifyRes.text().catch(() => '');
      this.logger.warn(`Google token verification failed (${verifyRes.status}): ${body.slice(0, 200)}`);
      throw new UnauthorizedException('Google ID token verification failed');
    }
    const payload = await verifyRes.json() as { sub: string; email: string; name: string; aud: string; email_verified: string };

    if (payload.aud !== clientId)         throw new UnauthorizedException('Google token audience mismatch');
    if (payload.email_verified !== 'true') throw new UnauthorizedException('Google email not verified');

    return { providerId: payload.sub, email: payload.email, displayName: payload.name };
  }
}
