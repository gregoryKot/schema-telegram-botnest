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
import { randomBytes } from 'crypto';
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
      nonce: randomBytes(16).toString('hex'),
      linkUserId: (req as any).webUser?.userId?.toString() ?? null,
    })).toString('base64url');
    res.cookie('oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/auth' });

    // Google uses response_mode=form_post so we need an idTokenNonce in a
    // SameSite=None cookie (the browser must send it on the cross-site POST).
    if (provider === 'google') {
      const idTokenNonce = randomBytes(16).toString('hex');
      res.cookie('google_nonce', idTokenNonce, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 10 * 60 * 1000, path: '/api/auth' });
      res.redirect(handler.buildAuthUrl(state, idTokenNonce));
      return;
    }

    res.redirect(handler.buildAuthUrl(state));
  }

  private requireCsrf(req: any, endpoint: string): void {
    if (!hasCsrfHeader(req)) {
      this.securityLog.log('csrf_blocked', { endpoint, ip: req.ip, ua: (req.headers['user-agent'] ?? '').slice(0, 80) });
      throw new UnauthorizedException('Missing CSRF header');
    }
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

  // Google uses response_mode=form_post — the browser POSTs id_token here.
  // No server→Google network call needed: we verify the JWT locally via JWKS.
  @Post('google/callback')
  @HttpCode(302)
  async googleCallbackPost(
    @Body('id_token') idToken: string,
    @Body('state') state: string,
    @Body('error') error: string,
    @Req() req: any, @Res() res: any,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const handler = this.providers.get('google');
      if (!handler.verifyIdToken) throw new BadRequestException('Google does not support id_token flow');
      if (error) throw new UnauthorizedException(`google auth denied: ${error}`);
      if (!idToken) throw new BadRequestException('Missing id_token');

      const expectedNonce = req.cookies?.['google_nonce'];
      if (!expectedNonce) throw new UnauthorizedException('Missing google_nonce cookie');
      res.clearCookie('google_nonce', { path: '/api/auth' });

      const identity = await handler.verifyIdToken(idToken, expectedNonce);

      let linkUserId: bigint | null = null;
      try {
        const raw = JSON.parse(Buffer.from(state ?? '', 'base64url').toString()).linkUserId;
        if (raw) linkUserId = BigInt(raw);
      } catch { /* ignore */ }

      const outcome = await this.signInOrLinkOrMerge('google', identity, {
        linkUserId, ip: req.ip, userAgent: req.headers['user-agent'],
      });

      if (outcome.kind === 'merge') {
        const params = new URLSearchParams({
          token: outcome.mergeToken,
          summary: JSON.stringify(outcome.summary),
          provider: 'google',
          name: outcome.otherDisplay ?? '',
        });
        res.redirect(`${frontendBase}/account/merge?${params.toString()}`);
        return;
      }

      res.cookie(REFRESH_COOKIE, outcome.tokens.refreshToken, cookieOptions(30 * 24 * 3600));
      res.redirect(`${frontendBase}/auth/callback#access_token=${outcome.tokens.accessToken}&expires_in=${outcome.tokens.expiresIn}`);
    } catch (err) {
      this.logger.error(`google callback error: ${(err as Error).message}`);
      res.redirect(`${frontendBase}/auth/error?reason=google_failed`);
    }
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
    @Query('device_id') deviceId: string, @Query('error') error: string,
    @Req() req: any, @Res() res: any,
  ): Promise<void> {
    // VK ID needs device_id + PKCE state for token exchange. Bypass the
    // generic helper and call the provider-specific method.
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const vk = this.providers.get('vk') as any;
      if (error) throw new UnauthorizedException(`vk auth denied: ${error}`);
      if (!code || !state || !deviceId) throw new BadRequestException('Missing code / state / device_id');

      const savedState = req.cookies?.['oauth_state'];
      if (!savedState || savedState !== state) throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const identity = await vk.exchangeCodeWithContext(code, deviceId, state);

      let linkUserId: bigint | null = null;
      try {
        const raw = JSON.parse(Buffer.from(state, 'base64url').toString()).linkUserId;
        if (raw) linkUserId = BigInt(raw);
      } catch { /* ignore */ }

      const outcome = await this.signInOrLinkOrMerge('vk', identity, {
        linkUserId, ip: req.ip, userAgent: req.headers['user-agent'],
      });

      if (outcome.kind === 'merge') {
        const params = new URLSearchParams({
          token: outcome.mergeToken,
          summary: JSON.stringify(outcome.summary),
          provider: 'vk',
          name: outcome.otherDisplay ?? '',
        });
        res.redirect(`${frontendBase}/account/merge?${params.toString()}`);
        return;
      }

      res.cookie(REFRESH_COOKIE, outcome.tokens.refreshToken, cookieOptions(30 * 24 * 3600));
      res.redirect(`${frontendBase}/auth/callback#access_token=${outcome.tokens.accessToken}&expires_in=${outcome.tokens.expiresIn}`);
    } catch (err) {
      this.logger.error(`vk callback error: ${(err as Error).message}`);
      res.redirect(`${frontendBase}/auth/error?reason=vk_failed`);
    }
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
    this.requireCsrf(req, 'telegram/widget');
    const telegramHandler = this.providers.get('telegram');
    if (!telegramHandler.verifyClientData) throw new BadRequestException('Telegram provider does not support direct verification');
    const identity = telegramHandler.verifyClientData(body);
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
    this.requireCsrf(req, "merge");
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
    try {
      await this.merge.merge(source, target);
    } catch (err) {
      const msg = (err as Error).message ?? 'merge failed';
      // Full error → logs + admin alert (AlertLogger picks up .error).
      this.logger.error(`merge ${source} → ${target} failed: ${msg}`, (err as Error).stack);
      // Friendly message to client — no Prisma internals leaked.
      throw new BadRequestException('Не удалось объединить аккаунты. Админ уведомлён — попробуйте позже.');
    }

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
    this.requireCsrf(req, "refresh");
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
    this.requireCsrf(req, "logout");
    const rawRefresh = req.cookies?.[REFRESH_COOKIE];
    if (rawRefresh) {
      if (all === 'true') {
        try {
          const tokens = await this.auth.rotateRefreshToken(rawRefresh);
          const { userId } = this.auth.verifyAccessToken(tokens.accessToken);
          await this.auth.revokeAllSessions(userId as bigint);
        } catch (err) {
          if (!(err instanceof UnauthorizedException)) {
            this.logger.error(`logout all-sessions error: ${(err as Error).message}`, err);
          }
          // UnauthorizedException = token already invalid, fine to continue logout
        }
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
