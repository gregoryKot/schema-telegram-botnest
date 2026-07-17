import type { Request, Response } from 'express';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { ProviderIdentity } from './providers/types';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';

export const REFRESH_COOKIE = 'refresh_token';
const CSRF_HEADER = 'x-requested-with';

// express типизирует Request.cookies как any — читаем куки через одну
// типобезопасную обёртку вместо россыпи unsafe-обращений по контроллерам.
export function getCookie(req: Request, name: string): string | undefined {
  const jar = req.cookies as Record<string, string | undefined> | undefined;
  return jar?.[name];
}

// linkUserId зашит в base64url-state OAuth-редиректа — разбираем типобезопасно.
export function linkUserIdFromState(state: string): bigint | null {
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      linkUserId?: string | null;
    };
    return parsed.linkUserId ? BigInt(parsed.linkUserId) : null;
  } catch {
    return null;
  }
}

function hasCsrfHeader(req: Request): boolean {
  // Primary check: x-requested-with header set by our webapp fetch calls.
  const v = req.headers?.[CSRF_HEADER];
  if (typeof v === 'string' && v.length > 0) return true;
  // Fallback: Content-Type: application/json is also CSRF-safe.
  // Cross-origin form submissions cannot set this content-type without
  // triggering a CORS preflight, which our server rejects for unknown origins.
  // Reverse proxies (e.g. Amvera load balancer) may strip x-requested-with,
  // but they never strip Content-Type — it's required for request parsing.
  const ct = String(req.headers?.['content-type'] ?? '');
  return ct.startsWith('application/json');
}

export function cookieOptions(maxAgeS: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: maxAgeS * 1000,
  };
}

// Shared auth-flow logic used by both AuthController and AuthOAuthController.
// Holds the provider sign-in/link/merge state machine, the OAuth redirect and
// callback plumbing, and the CSRF gate. Kept out of the controllers so each
// controller file stays a thin list of route handlers.
@Injectable()
export class AuthFlowService {
  private readonly logger = new Logger(AuthFlowService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
    private readonly totp: TotpService,
  ) {}

  // ─── Generic helper ───────────────────────────────────────────────────────
  //
  // signInOrLinkOrMerge handles the three outcomes after we obtain a
  // ProviderIdentity from any provider:
  //
  //   1. No linkUserId given → sign-in or sign-up (findOrCreate). Issue tokens.
  //   2. linkUserId given, no conflict → link provider to that user. Issue tokens
  //      (refresh token of the active user is already valid; we re-issue for
  //      consistency).
  //   3. linkUserId given, but providerId already belongs to another user →
  //      return a merge token; the UI asks the user to confirm before we
  //      destroy the other account.
  //
  // Returns either { tokens } or { mergeToken, summary } so the caller can act.
  async signInOrLinkOrMerge(
    providerId_: string,
    identity: ProviderIdentity,
    opts: { linkUserId: bigint | null; ip?: string; userAgent?: string },
  ): Promise<
    | {
        kind: 'tokens';
        userId: bigint;
        tokens: Awaited<ReturnType<AuthService['issueTokens']>>;
      }
    | { kind: 'totp_challenge'; userId: bigint; challengeToken: string }
    | {
        kind: 'merge';
        mergeToken: string;
        summary: Record<string, number>;
        otherDisplay: string | null;
      }
  > {
    const { linkUserId, ip, userAgent } = opts;

    if (linkUserId === null) {
      const userId = await this.auth.findOrCreateUserByProvider(
        providerId_,
        identity.providerId,
        identity.displayName,
        identity.email,
      );
      // 2FA gate: if user has TOTP enabled, don't issue tokens yet — return
      // a challenge token that the client exchanges for tokens after typing
      // a valid 6-digit code on /api/auth/2fa/challenge.
      if (await this.totp.isEnabled(userId)) {
        const challengeToken = this.auth.buildTotpChallengeToken(
          userId,
          ip,
          userAgent,
        );
        return { kind: 'totp_challenge', userId, challengeToken };
      }
      const tokens = await this.auth.issueTokens(userId, ip, userAgent);
      return { kind: 'tokens', userId, tokens };
    }

    const result = await this.auth.linkProviderToUser(
      linkUserId,
      providerId_,
      identity.providerId,
      identity.displayName,
      identity.email,
    );

    if (result.ok) {
      // Linking an additional provider doesn't need re-2FA — the user is
      // already authed in this session.
      const tokens = await this.auth.issueTokens(linkUserId, ip, userAgent);
      return { kind: 'tokens', userId: linkUserId, tokens };
    }

    // Conflict — issue a signed merge token, return data summary for UI.
    const sourceId = BigInt(result.conflictUserId);
    const mergeToken = this.auth.buildMergeToken(
      linkUserId,
      sourceId,
      providerId_,
      identity.providerId,
    );
    const summary = await this.merge.summarize(sourceId);
    return {
      kind: 'merge',
      mergeToken,
      summary,
      otherDisplay: identity.displayName ?? identity.email ?? null,
    };
  }

  // Shared response handler for OAuth redirect callbacks (Google, VK, Telegram-OIDC).
  // Routes the user to the right next page based on the outcome.
  finishOAuthRedirect(
    outcome: Awaited<ReturnType<AuthFlowService['signInOrLinkOrMerge']>>,
    provider: string,
    res: Response,
    frontendBase: string,
  ): void {
    if (outcome.kind === 'merge') {
      const params = new URLSearchParams({
        token: outcome.mergeToken,
        summary: JSON.stringify(outcome.summary),
        provider,
        name: outcome.otherDisplay ?? '',
      });
      res.redirect(`${frontendBase}/account/merge?${params.toString()}`);
      return;
    }
    if (outcome.kind === 'totp_challenge') {
      res.redirect(
        `${frontendBase}/auth/2fa?token=${encodeURIComponent(outcome.challengeToken)}`,
      );
      return;
    }
    res.cookie(
      REFRESH_COOKIE,
      outcome.tokens.refreshToken,
      cookieOptions(30 * 24 * 3600),
    );
    res.redirect(
      `${frontendBase}/auth/callback#access_token=${outcome.tokens.accessToken}&expires_in=${outcome.tokens.expiresIn}`,
    );
  }

  // ─── OAuth helpers ────────────────────────────────────────────────────────
  //
  // Each redirect-flow provider has a tiny stub that calls these helpers.
  // Adding a new OAuth provider (Yandex, Apple, …) = add provider file,
  // register in AuthProviderRegistry/AuthModule, add stub here:
  //
  //   @Get('yandex') @UseGuards(OptionalJwtGuard)
  //   yandexRedirect(@Req() r,@Res() s) { return this.oauthRedirect('yandex', r, s); }
  //   @Get('yandex/callback')
  //   yandexCallback(...) { return this.oauthCallback('yandex', ...); }
  //
  // We don't use Get(':provider') because it would shadow /me, /refresh etc.

  oauthRedirect(provider: string, req: Request, res: Response): void {
    const handler = this.providers.get(provider);
    if (!handler.buildAuthUrl)
      throw new BadRequestException(
        `Provider ${provider} doesn't support OAuth`,
      );
    const state = Buffer.from(
      JSON.stringify({
        nonce: randomBytes(16).toString('hex'),
        linkUserId: req.webUser?.userId?.toString() ?? null,
      }),
    ).toString('base64url');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth',
    });
    res.redirect(handler.buildAuthUrl(state));
  }

  requireCsrf(req: Request, endpoint: string): void {
    if (!hasCsrfHeader(req)) {
      this.securityLog.log('csrf_blocked', {
        endpoint,
        ip: req.ip,
        ua: (req.headers['user-agent'] ?? '').slice(0, 80),
      });
      throw new UnauthorizedException('Missing CSRF header');
    }
  }

  async oauthCallback(
    provider: string,
    code: string,
    state: string,
    error: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const handler = this.providers.get(provider);
      if (!handler.exchangeCode)
        throw new BadRequestException(
          `Provider ${provider} doesn't support OAuth`,
        );
      if (error) throw new UnauthorizedException(`${provider} auth denied`);
      if (!code || !state)
        throw new BadRequestException('Missing code or state');

      const savedState = getCookie(req, 'oauth_state');
      if (!savedState || savedState !== state)
        throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const identity = await handler.exchangeCode(code);
      const linkUserId = linkUserIdFromState(state);

      const outcome = await this.signInOrLinkOrMerge(provider, identity, {
        linkUserId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      this.finishOAuthRedirect(outcome, provider, res, frontendBase);
    } catch (err) {
      this.logger.error(
        `${provider} callback error: ${(err as Error).message}`,
      );
      res.redirect(`${frontendBase}/auth/error?reason=${provider}_failed`);
    }
  }
}
