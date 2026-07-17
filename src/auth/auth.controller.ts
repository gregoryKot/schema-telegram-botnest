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
import { JwtAuthGuard, WebUser } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import { EmailService } from './email.service';
import {
  AuthFlowService,
  REFRESH_COOKIE,
  cookieOptions,
} from './auth-flow.service';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
    private readonly totp: TotpService,
    private readonly emailSvc: EmailService,
    private readonly flow: AuthFlowService,
  ) {}

  // ─── Email magic-link login ───────────────────────────────────────────────

  @Post('email/link')
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async emailLoginLink(
    @Body('email') email: string,
    @Req() req: any,
  ): Promise<{ ok: true }> {
    this.flow.requireCsrf(req, 'email/link');
    return this.auth.requestEmailLogin(email);
  }

  @Get('email/callback')
  async emailLoginCallback(
    @Query('token') token: string,
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const { tokens, purpose } = await this.auth.consumeEmailToken(
        token,
        req.ip,
        req.headers['user-agent'],
      );
      res.cookie(
        REFRESH_COOKIE,
        tokens.refreshToken,
        cookieOptions(30 * 24 * 3600),
      );
      if (purpose === 'link_email_auth') {
        // Already logged in — go back to account with success banner
        res.redirect(`${frontendBase}/account?linked=email`);
      } else {
        res.redirect(
          `${frontendBase}/auth/callback#access_token=${tokens.accessToken}&expires_in=${tokens.expiresIn}`,
        );
      }
    } catch (err) {
      this.logger.error(`Email callback: ${(err as Error).message}`);
      res.redirect(`${frontendBase}/auth/error?reason=email_link_expired`);
    }
  }

  // ─── Link email to existing account ──────────────────────────────────────

  @Post('email/link-to-account')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async emailLinkToAccount(
    @Body('email') email: string,
    @Req() req: any,
  ): Promise<{ ok: true }> {
    this.flow.requireCsrf(req, 'email/link-to-account');
    const webUser: WebUser = req.webUser;
    return this.auth.linkEmailToAccount(webUser.userId, email);
  }

  // ─── Telegram WebApp initData (mini-app auto-auth) ────────────────────────

  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @Post('telegram/webapp')
  @HttpCode(200)
  async telegramWebApp(
    @Body('initData') initData: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!initData) throw new BadRequestException('Missing initData');
    const { id: telegramId, firstName } =
      this.auth.verifyTelegramWebAppData(initData);
    const userId = await this.auth.findOrCreateUserByProvider(
      'telegram',
      String(telegramId),
      firstName,
    );
    const tokens = await this.auth.issueTokens(
      userId,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_COOKIE,
      tokens.refreshToken,
      cookieOptions(30 * 24 * 3600),
    );
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Link an additional provider (Telegram widget → existing account) ────

  @Post('link/:provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async linkProvider(
    @Param('provider') provider: string,
    // Не DTO: подписанный Telegram-payload, whitelist срежет поля и сломает hash-верификацию.
    @Body() body: Record<string, unknown>,
    @Req() req: any,
  ): Promise<
    | { ok: true }
    | { merge: true; mergeToken: string; summary: Record<string, number> }
  > {
    const handler = this.providers.get(provider);
    if (!handler.verifyClientData) {
      throw new BadRequestException(
        `Provider ${provider} doesn't support direct linking — use OAuth flow`,
      );
    }
    const identity = handler.verifyClientData(body);
    const webUser: WebUser = req.webUser;

    const result = await this.auth.linkProviderToUser(
      webUser.userId,
      provider,
      identity.providerId,
      identity.displayName,
      identity.email,
    );
    if (result.ok) return { ok: true };

    // Conflict — give the UI a merge token.
    const sourceId = BigInt(result.conflictUserId);
    const mergeToken = this.auth.buildMergeToken(
      webUser.userId,
      sourceId,
      provider,
      identity.providerId,
    );
    const summary = await this.merge.summarize(sourceId);
    return { merge: true, mergeToken, summary };
  }

  // ─── Unlink a provider ────────────────────────────────────────────────────

  @Post('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async unlink(
    @Param('provider') provider: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    if (!this.providers.list().some((p) => p.id === provider)) {
      throw new BadRequestException('Unknown provider');
    }
    const webUser: WebUser = req.webUser;
    await this.auth.unlinkProvider(webUser.userId, provider as any);
    this.securityLog.log('provider_unlinked', {
      userId: webUser.userId,
      provider,
      ip: req.ip,
    });
    return { ok: true };
  }

  // ─── Token refresh ─────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    this.flow.requireCsrf(req, 'refresh');
    const rawRefresh = req.cookies?.[REFRESH_COOKIE];
    if (!rawRefresh) throw new UnauthorizedException('No refresh token');
    const tokens = await this.auth.rotateRefreshToken(
      rawRefresh,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_COOKIE,
      tokens.refreshToken,
      cookieOptions(30 * 24 * 3600),
    );
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
    this.flow.requireCsrf(req, 'logout');
    const rawRefresh = req.cookies?.[REFRESH_COOKIE];
    if (rawRefresh) {
      if (all === 'true') {
        try {
          const tokens = await this.auth.rotateRefreshToken(rawRefresh);
          const { userId } = this.auth.verifyAccessToken(tokens.accessToken);
          await this.auth.revokeAllSessions(userId);
        } catch (err) {
          if (!(err instanceof UnauthorizedException)) {
            this.logger.error(
              `logout all-sessions error: ${(err as Error).message}`,
              err,
            );
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
    providers: Array<{
      provider: string;
      email: string | null;
      displayName: string | null;
    }>;
    totp: { enabled: boolean; recoveryCodesLeft: number };
  }> {
    const webUser: WebUser = req.webUser;
    const [providers, totp] = await Promise.all([
      this.auth.getUserProviders(webUser.userId),
      this.totp.getStatus(webUser.userId),
    ]);
    return { userId: String(webUser.userId), providers, totp };
  }

  // ─── 2FA (TOTP) management ────────────────────────────────────────────────

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async totpSetup(
    @Req() req: any,
  ): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    this.flow.requireCsrf(req, '2fa/setup');
    const webUser: WebUser = req.webUser;
    // Use one of the user's display names for the QR label
    const providers = await this.auth.getUserProviders(webUser.userId);
    const label =
      providers[0]?.email ??
      providers[0]?.displayName ??
      `user-${webUser.userId}`;
    return this.totp.startSetup(webUser.userId, label);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async totpEnable(
    @Req() req: any,
    @Body('code') code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    this.flow.requireCsrf(req, '2fa/enable');
    if (!code) throw new BadRequestException('Missing code');
    const webUser: WebUser = req.webUser;
    const result = await this.totp.confirmSetup(webUser.userId, code);
    this.securityLog.log('role_changed', {
      userId: webUser.userId,
      event: '2fa_enabled',
    });
    return result;
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async totpDisable(
    @Req() req: any,
    @Body('code') code: string,
  ): Promise<{ ok: true }> {
    this.flow.requireCsrf(req, '2fa/disable');
    if (!code) throw new BadRequestException('Missing code');
    const webUser: WebUser = req.webUser;
    await this.totp.disable(webUser.userId, code);
    this.securityLog.log('role_changed', {
      userId: webUser.userId,
      event: '2fa_disabled',
    });
    return { ok: true };
  }

  @Post('2fa/recovery-codes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async totpRegenerateRecovery(
    @Req() req: any,
    @Body('code') code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    this.flow.requireCsrf(req, '2fa/recovery-codes');
    if (!code) throw new BadRequestException('Missing code');
    const webUser: WebUser = req.webUser;
    return this.totp.regenerateRecoveryCodes(webUser.userId, code);
  }

  // ─── Recovery email ──────────────────────────────────────────────────────

  @Post('recovery-email/start')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 24 * 3_600_000 },
  })
  @HttpCode(200)
  async recoveryEmailStart(
    @Req() req: any,
    @Body('email') email: string,
  ): Promise<{ ok: true }> {
    this.flow.requireCsrf(req, 'recovery-email/start');
    const webUser: WebUser = req.webUser;
    return this.emailSvc.sendVerificationLink(webUser.userId, email);
  }

  @Get('recovery-email/verify')
  async recoveryEmailVerify(
    @Query('token') token: string,
    @Res() res: any,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      await this.emailSvc.consumeToken(token, 'verify_email');
      res.redirect(`${frontendBase}/account?verified=1`);
    } catch (err) {
      this.logger.error(
        `recovery email verify failed: ${(err as Error).message}`,
      );
      res.redirect(`${frontendBase}/account?verified=0`);
    }
  }

  // Public — anyone can request a recovery link by email. We silently
  // succeed regardless to avoid leaking which emails are registered.
  @Post('recovery/request')
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 24 * 3_600_000 },
  })
  @HttpCode(200)
  async recoveryRequest(@Body('email') email: string): Promise<{ ok: true }> {
    return this.emailSvc.sendRecoveryLink(email);
  }

  // Confirm a recovery magic link → issue a session for that user. They land
  // on /account and can link a new provider before the original token expires.
  @Post('recovery/confirm')
  @HttpCode(200)
  async recoveryConfirm(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body('token') token: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    this.flow.requireCsrf(req, 'recovery/confirm');
    const { userId } = await this.emailSvc.consumeToken(token, 'recovery');
    // Recovery DOES skip 2FA — the email proves possession of a separate
    // factor. Otherwise losing TOTP + all providers = unrecoverable account.
    const tokens = await this.auth.issueTokens(
      userId,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_COOKIE,
      tokens.refreshToken,
      cookieOptions(30 * 24 * 3600),
    );
    this.securityLog.log('role_changed', {
      userId,
      event: 'recovery_login',
      ip: req.ip,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // Verify a TOTP code in exchange for a real access token. Called by the
  // /auth/2fa frontend page after primary login returned a challengeToken.
  @Post('2fa/challenge')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async totpChallenge(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body('challengeToken') challengeToken: string,
    @Body('code') code: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    this.flow.requireCsrf(req, '2fa/challenge');
    if (!challengeToken || !code)
      throw new BadRequestException('Missing token or code');
    const { userId } = this.auth.verifyTotpChallengeToken(challengeToken);
    const ok = await this.totp.verifyCode(userId, code);
    if (!ok) throw new UnauthorizedException('Invalid 2FA code');
    const tokens = await this.auth.issueTokens(
      userId,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_COOKIE,
      tokens.refreshToken,
      cookieOptions(30 * 24 * 3600),
    );
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
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
  async issueLinkToken(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ linkToken: string; expiresIn: number }> {
    const webUser: WebUser = req.webUser;
    const linkToken = this.auth.buildLinkToken(webUser.userId);
    // Основной канал доставки — httpOnly-cookie (S-4): токен не попадает в
    // URL/логи. Тело ответа сохранено для обратной совместимости со старыми
    // клиентами, которые ещё передают ?link_token=.
    res.cookie('link_token', linkToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: 60_000,
      path: '/api/auth',
    });
    return { linkToken, expiresIn: 60 };
  }
}
