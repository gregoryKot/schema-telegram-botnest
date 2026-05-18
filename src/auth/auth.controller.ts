import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  Param,
  UnauthorizedException,
  BadRequestException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard, OptionalJwtGuard, WebUser } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { ProviderIdentity } from './providers/types';
import { SecurityLogService } from './security-log.service';

const REFRESH_COOKIE = 'refresh_token';
const CSRF_HEADER = 'x-requested-with';

function hasCsrfHeader(req: any): boolean {
  const v = req.headers?.[CSRF_HEADER];
  return typeof v === 'string' && v.length > 0;
}

function cookieOptions(maxAgeS: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: maxAgeS * 1000,
  };
}

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
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
  private async signInOrLinkOrMerge(
    providerId_: string,
    identity: ProviderIdentity,
    opts: { linkUserId: bigint | null; ip?: string; userAgent?: string },
  ): Promise<
    | { kind: 'tokens'; userId: bigint; tokens: Awaited<ReturnType<AuthService['issueTokens']>> }
    | { kind: 'merge'; mergeToken: string; summary: Record<string, number>; otherDisplay: string | null }
  > {
    const { linkUserId, ip, userAgent } = opts;

    if (linkUserId === null) {
      const userId = (await this.auth.findOrCreateUserByProvider(
        providerId_ as any, identity.providerId, identity.displayName, identity.email,
      )) as bigint;
      const tokens = await this.auth.issueTokens(userId, ip, userAgent);
      return { kind: 'tokens', userId, tokens };
    }

    const result = await this.auth.linkProviderToUser(
      linkUserId, providerId_, identity.providerId, identity.displayName, identity.email,
    );

    if (result.ok) {
      const tokens = await this.auth.issueTokens(linkUserId, ip, userAgent);
      return { kind: 'tokens', userId: linkUserId, tokens };
    }

    // Conflict — issue a signed merge token, return data summary for UI.
    const sourceId = BigInt(result.conflictUserId);
    const mergeToken = this.auth.buildMergeToken(linkUserId, sourceId, providerId_, identity.providerId);
    const summary = await this.merge.summarize(sourceId);
    return { kind: 'merge', mergeToken, summary, otherDisplay: identity.displayName ?? identity.email ?? null };
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

  private oauthRedirect(provider: string, req: any, res: any): void {
    const handler = this.providers.get(provider);
    if (!handler.buildAuthUrl) throw new BadRequestException(`Provider ${provider} doesn't support OAuth`);
    const state = Buffer.from(JSON.stringify({
      nonce: Math.random().toString(36).slice(2),
      linkUserId: (req as any).webUser?.userId?.toString() ?? null,
    })).toString('base64url');
    res.cookie('oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/auth' });
    res.redirect(handler.buildAuthUrl(state));
  }

  private async oauthCallback(
    provider: string, code: string, state: string, error: string, req: any, res: any,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const handler = this.providers.get(provider);
      if (!handler.exchangeCode) throw new BadRequestException(`Provider ${provider} doesn't support OAuth`);
      if (error) throw new UnauthorizedException(`${provider} auth denied`);
      if (!code || !state) throw new BadRequestException('Missing code or state');

      const savedState = req.cookies?.['oauth_state'];
      if (!savedState || savedState !== state) throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const identity = await handler.exchangeCode(code);
      let linkUserId: bigint | null = null;
      try {
        const raw = JSON.parse(Buffer.from(state, 'base64url').toString()).linkUserId;
        if (raw) linkUserId = BigInt(raw);
      } catch { /* ignore */ }

      const outcome = await this.signInOrLinkOrMerge(provider, identity, {
        linkUserId, ip: req.ip, userAgent: req.headers['user-agent'],
      });

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

      res.cookie(REFRESH_COOKIE, outcome.tokens.refreshToken, cookieOptions(30 * 24 * 3600));
      res.redirect(`${frontendBase}/auth/callback#access_token=${outcome.tokens.accessToken}&expires_in=${outcome.tokens.expiresIn}`);
    } catch (err) {
      this.logger.error(`${provider} callback error: ${(err as Error).message}`);
      res.redirect(`${frontendBase}/auth/error?reason=${provider}_failed`);
    }
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(OptionalJwtGuard)
  googleRedirect(@Req() req: any, @Res() res: any): void {
    return this.oauthRedirect('google', req, res);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string, @Query('state') state: string,
    @Query('error') error: string, @Req() req: any, @Res() res: any,
  ): Promise<void> {
    return this.oauthCallback('google', code, state, error, req, res);
  }

  // ─── VK OAuth ─────────────────────────────────────────────────────────────

  @Get('vk')
  @UseGuards(OptionalJwtGuard)
  vkRedirect(@Req() req: any, @Res() res: any): void {
    return this.oauthRedirect('vk', req, res);
  }

  @Get('vk/callback')
  async vkCallback(
    @Query('code') code: string, @Query('state') state: string,
    @Query('error') error: string, @Req() req: any, @Res() res: any,
  ): Promise<void> {
    return this.oauthCallback('vk', code, state, error, req, res);
  }

  // ─── Telegram Login Widget ────────────────────────────────────────────────

  @Post('telegram/widget')
  @UseGuards(OptionalJwtGuard)
  @Throttle({ short: { limit: 5, ttl: 60_000 }, long: { limit: 30, ttl: 3_600_000 } })
  @HttpCode(200)
  async telegramWidget(
    @Body() body: Record<string, string>,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<any> {
    const identity = this.providers.get('telegram').verifyClientData!(body);
    const linkUserId = (req as any).webUser?.userId ?? null;

    const outcome = await this.signInOrLinkOrMerge('telegram', identity, {
      linkUserId: linkUserId ? BigInt(String(linkUserId)) : null,
      ip: req.ip, userAgent: req.headers['user-agent'],
    });

    if (outcome.kind === 'merge') {
      return {
        merge: true,
        mergeToken: outcome.mergeToken,
        summary: outcome.summary,
        otherDisplay: outcome.otherDisplay,
        provider: 'telegram',
      };
    }
    res.cookie(REFRESH_COOKIE, outcome.tokens.refreshToken, cookieOptions(30 * 24 * 3600));
    return { accessToken: outcome.tokens.accessToken, expiresIn: outcome.tokens.expiresIn };
  }

  // ─── Telegram WebApp initData (mini-app auto-auth) ────────────────────────

  @Post('telegram/webapp')
  @HttpCode(200)
  async telegramWebApp(
    @Body('initData') initData: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!initData) throw new BadRequestException('Missing initData');
    const { id: telegramId, firstName } = this.auth.verifyTelegramWebAppData(initData);
    const userId = (await this.auth.findOrCreateUserByProvider(
      'telegram', String(telegramId), firstName,
    )) as bigint;
    const tokens = await this.auth.issueTokens(userId, req.ip, req.headers['user-agent']);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(30 * 24 * 3600));
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Confirm a pending merge ──────────────────────────────────────────────

  @Post('merge')
  @UseGuards(OptionalJwtGuard)
  @Throttle({ short: { limit: 3, ttl: 60_000 }, long: { limit: 10, ttl: 3_600_000 } })
  @HttpCode(200)
  async confirmMerge(
    @Body('token') token: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // CSRF: require the custom header same way refresh/logout do. Browser
    // cannot set it from a cross-origin form/img.
    if (!hasCsrfHeader(req)) throw new UnauthorizedException('Missing CSRF header');
    if (!token) throw new BadRequestException('Missing merge token');
    const { target, source, provider, providerId } = this.auth.verifyMergeToken(token);

    // Security: the caller MUST be authenticated as either:
    //   - the target user (started a link from an active session), OR
    //   - via the OAuth callback flow where the token was issued moments ago
    //     and the caller went directly from /auth/google/callback to /merge.
    //
    // For (1) we verify via JWT. For (2) we accept if no JWT is present
    // because the merge token itself is the proof of intent: it was just
    // issued to the same browser session and we trust the signed payload.
    // We do NOT accept if someone is logged in as a DIFFERENT user.
    const webUser = (req as any).webUser;
    if (webUser && String(webUser.userId) !== String(target)) {
      throw new UnauthorizedException('Merge token does not match current session');
    }

    // 1. Move data from source → target.
    await this.merge.merge(source, target);

    // 2. Link the provider that triggered the merge to the target user.
    const linkRes = await this.auth.linkProviderToUser(target, provider, providerId);
    if (!linkRes.ok) {
      // Should be impossible — source's provider row was moved to target by
      // merge() above. Be defensive.
      throw new BadRequestException('Provider link failed after merge');
    }

    // 3. Issue fresh tokens for the target user.
    const tokens = await this.auth.issueTokens(target, req.ip, req.headers['user-agent']);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(30 * 24 * 3600));
    this.securityLog.log('merge_confirmed', { target, source, provider, ip: req.ip });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Link an additional provider (Telegram widget → existing account) ────

  @Post('link/:provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async linkProvider(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Req() req: any,
  ): Promise<{ ok: true } | { merge: true; mergeToken: string; summary: Record<string, number> }> {
    const handler = this.providers.get(provider);
    if (!handler.verifyClientData) {
      throw new BadRequestException(`Provider ${provider} doesn't support direct linking — use OAuth flow`);
    }
    const identity = handler.verifyClientData(body);
    const webUser: WebUser = req.webUser;

    const result = await this.auth.linkProviderToUser(
      webUser.userId as bigint, provider, identity.providerId, identity.displayName, identity.email,
    );
    if (result.ok) return { ok: true };

    // Conflict — give the UI a merge token.
    const sourceId = BigInt(result.conflictUserId);
    const mergeToken = this.auth.buildMergeToken(
      webUser.userId as bigint, sourceId, provider, identity.providerId,
    );
    const summary = await this.merge.summarize(sourceId);
    return { merge: true, mergeToken, summary };
  }

  // ─── Unlink a provider ────────────────────────────────────────────────────

  @Post('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async unlink(@Param('provider') provider: string, @Req() req: any): Promise<{ ok: boolean }> {
    if (!this.providers.list().some(p => p.id === provider)) {
      throw new BadRequestException('Unknown provider');
    }
    const webUser: WebUser = req.webUser;
    await this.auth.unlinkProvider(webUser.userId as bigint, provider as any);
    this.securityLog.log('provider_unlinked', { userId: webUser.userId, provider, ip: req.ip });
    return { ok: true };
  }

  // ─── Token refresh ─────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!hasCsrfHeader(req)) throw new UnauthorizedException('Missing CSRF header');
    const rawRefresh = req.cookies?.[REFRESH_COOKIE];
    if (!rawRefresh) throw new UnauthorizedException('No refresh token');
    const tokens = await this.auth.rotateRefreshToken(rawRefresh, req.ip, req.headers['user-agent']);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(30 * 24 * 3600));
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Query('all') all: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ ok: boolean }> {
    if (!hasCsrfHeader(req)) throw new UnauthorizedException('Missing CSRF header');
    const rawRefresh = req.cookies?.[REFRESH_COOKIE];
    if (rawRefresh) {
      if (all === 'true') {
        try {
          const tokens = await this.auth.rotateRefreshToken(rawRefresh);
          const { userId } = this.auth.verifyAccessToken(tokens.accessToken);
          await this.auth.revokeAllSessions(userId as bigint);
        } catch { /* token may already be invalid */ }
      } else {
        await this.auth.revokeSession(rawRefresh);
      }
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { ok: true };
  }

  // ─── Current user info ─────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any): Promise<{
    userId: string;
    providers: Array<{ provider: string; email: string | null; displayName: string | null }>;
  }> {
    const webUser: WebUser = req.webUser;
    const providers = await this.auth.getUserProviders(webUser.userId as bigint);
    return { userId: String(webUser.userId), providers };
  }

  // ─── Issue a short-lived link token for the mini-app ─────────────────────
  //
  // The mini-app authenticates with `x-telegram-init-data` rather than JWT.
  // To kick off a Google (or any OAuth) link from inside the mini-app it
  // needs a JWT to pass as `?link_token=` to /api/auth/google.
  //
  // This endpoint is mounted in api.controller.ts (uses TelegramAuthGuard
  // which already understands initData). The endpoint here is a JWT-guarded
  // mirror, used by the web client if it needs one (rare).

  @Get('link-token')
  @UseGuards(JwtAuthGuard)
  async issueLinkToken(@Req() req: any): Promise<{ linkToken: string; expiresIn: number }> {
    const webUser: WebUser = req.webUser;
    const tokens = await this.auth.issueTokens(webUser.userId as bigint, req.ip, req.headers['user-agent']);
    return { linkToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }
}
