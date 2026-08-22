import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { ProviderIdentity } from './providers/types';
import { TotpService } from './totp.service';
import { getCookie, setRefreshCookie } from './auth-http.util';
import { signOAuthState, readOAuthState } from './oauth-state';

export type SignInOutcome =
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
    };

// Shared, injectable OAuth/sign-in flow helpers used by the auth controllers.
// Extracted verbatim from AuthController so route handlers stay thin and the
// controller files stay under the size ratchet — no behaviour change.
@Injectable()
export class AuthFlowService {
  private readonly logger = new Logger(AuthFlowService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
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
  ): Promise<SignInOutcome> {
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
    outcome: SignInOutcome,
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
    // crossSite:false — OAuth-редирект (Google/VK/Telegram-OIDC) приходит
    // top-level навигацией на наш домен, не iframe (setRefreshCookie заодно
    // чистит метку refresh_cross от возможной прежней MAX-сессии, правило №5).
    setRefreshCookie(res, outcome.tokens.refreshToken, 30 * 24 * 3600, false);
    res.redirect(
      `${frontendBase}/auth/callback#access_token=${outcome.tokens.accessToken}&expires_in=${outcome.tokens.expiresIn}`,
    );
  }

  // linkUserId в link-флоу едет через ПОДПИСАННЫЙ носитель (OAuth-`state` и
  // `tg_link_user`-куку). Неподписанный носитель давал захват аккаунта — крипта
  // и разбор в oauth-state.ts (C1). Единая точка: ни один редирект/кука не
  // должны вернуться к сырому значению.
  private stateSecret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }
  linkUserIdFromState(state: string): bigint | null {
    return readOAuthState(this.stateSecret(), state);
  }
  buildLinkState(linkUserId: bigint | null): string {
    return signOAuthState(this.stateSecret(), linkUserId);
  }
  readLinkState(raw: string | null | undefined): bigint | null {
    return readOAuthState(this.stateSecret(), raw);
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
    const state = this.buildLinkState(req.webUser?.userId ?? null);
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth',
    });
    res.redirect(handler.buildAuthUrl(state));
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
      const linkUserId = this.linkUserIdFromState(state);

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
