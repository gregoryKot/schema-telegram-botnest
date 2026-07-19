import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  UnauthorizedException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard, WebUser } from './jwt.guard';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import { TwoFaCodeDto, TwoFaChallengeDto } from './dto/twofa.dto';
import { EmailService } from './email.service';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE, cookieOptions, requireCsrf } from './auth-http.util';

@Controller('api/auth')
export class Auth2faController {
  private readonly logger = new Logger(Auth2faController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly securityLog: SecurityLogService,
    private readonly totp: TotpService,
    private readonly emailSvc: EmailService,
  ) {}

  // ─── 2FA (TOTP) management ────────────────────────────────────────────────

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async totpSetup(
    @Req() req: Request,
  ): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    requireCsrf(req, '2fa/setup', this.securityLog);
    const webUser: WebUser = req.webUser!;
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
    @Req() req: Request,
    @Body() dto: TwoFaCodeDto,
  ): Promise<{ recoveryCodes: string[] }> {
    requireCsrf(req, '2fa/enable', this.securityLog);
    const webUser: WebUser = req.webUser!;
    const result = await this.totp.confirmSetup(webUser.userId, dto.code);
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
    @Req() req: Request,
    @Body() dto: TwoFaCodeDto,
  ): Promise<{ ok: true }> {
    requireCsrf(req, '2fa/disable', this.securityLog);
    const webUser: WebUser = req.webUser!;
    await this.totp.disable(webUser.userId, dto.code);
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
    @Req() req: Request,
    @Body() dto: TwoFaCodeDto,
  ): Promise<{ recoveryCodes: string[] }> {
    requireCsrf(req, '2fa/recovery-codes', this.securityLog);
    const webUser: WebUser = req.webUser!;
    return this.totp.regenerateRecoveryCodes(webUser.userId, dto.code);
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
    @Req() req: Request,
    @Body('email') email: string,
  ): Promise<{ ok: true }> {
    requireCsrf(req, 'recovery-email/start', this.securityLog);
    const webUser: WebUser = req.webUser!;
    return this.emailSvc.sendVerificationLink(webUser.userId, email);
  }

  @Get('recovery-email/verify')
  async recoveryEmailVerify(
    @Query('token') token: string,
    @Res() res: Response,
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('token') token: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    requireCsrf(req, 'recovery/confirm', this.securityLog);
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: TwoFaChallengeDto,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    requireCsrf(req, '2fa/challenge', this.securityLog);
    const { userId } = this.auth.verifyTotpChallengeToken(dto.challengeToken);
    const ok = await this.totp.verifyCode(userId, dto.code);
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
}
