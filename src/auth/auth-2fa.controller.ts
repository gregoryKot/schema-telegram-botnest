import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard, WebUser } from './jwt.guard';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import { TwoFaCodeDto, TwoFaChallengeDto } from './dto/twofa.dto';
import type { Request, Response } from 'express';
import { requireCsrf, setRefreshCookie } from './auth-http.util';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import { CODE_THROTTLE } from './auth-throttles';

@Controller('api/auth')
export class Auth2faController {
  constructor(
    private readonly auth: AuthService,
    private readonly securityLog: SecurityLogService,
    private readonly totp: TotpService,
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
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async totpEnable(
    @Req() req: Request,
    @Body() dto: TwoFaCodeDto,
  ): Promise<{ recoveryCodes: string[] }> {
    requireCsrf(req, '2fa/enable', this.securityLog);
    const webUser: WebUser = req.webUser!;
    const result = await this.logTotpFailure(
      req,
      webUser.userId,
      '2fa/enable',
      () => this.totp.confirmSetup(webUser.userId, dto.code),
    );
    this.securityLog.log('role_changed', {
      userId: webUser.userId,
      event: '2fa_enabled',
    });
    return result;
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async totpDisable(
    @Req() req: Request,
    @Body() dto: TwoFaCodeDto,
  ): Promise<{ ok: true }> {
    requireCsrf(req, '2fa/disable', this.securityLog);
    const webUser: WebUser = req.webUser!;
    await this.logTotpFailure(req, webUser.userId, '2fa/disable', () =>
      this.totp.disable(webUser.userId, dto.code),
    );
    this.securityLog.log('role_changed', {
      userId: webUser.userId,
      event: '2fa_disabled',
    });
    return { ok: true };
  }

  @Post('2fa/recovery-codes')
  @UseGuards(JwtAuthGuard)
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async totpRegenerateRecovery(
    @Req() req: Request,
    @Body() dto: TwoFaCodeDto,
  ): Promise<{ recoveryCodes: string[] }> {
    requireCsrf(req, '2fa/recovery-codes', this.securityLog);
    const webUser: WebUser = req.webUser!;
    return this.logTotpFailure(req, webUser.userId, '2fa/recovery-codes', () =>
      this.totp.regenerateRecoveryCodes(webUser.userId, dto.code),
    );
  }

  // Verify a TOTP code in exchange for a real access token. Called by the
  // /auth/2fa frontend page after primary login returned a challengeToken.
  @Post('2fa/challenge')
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async totpChallenge(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: TwoFaChallengeDto,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    requireCsrf(req, '2fa/challenge', this.securityLog);
    const { userId } = this.auth.verifyTotpChallengeToken(dto.challengeToken);
    const ok = await this.totp.verifyCode(userId, dto.code);
    if (!ok) {
      this.logTotpFailed(req, userId, '2fa/challenge');
      throw new UnauthorizedException('Invalid 2FA code');
    }
    const tokens = await this.auth.issueTokens(
      userId,
      req.ip,
      req.headers['user-agent'],
    );
    setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, false);
    // Билет здесь НЕ одобряем: код в теле мог подставить кто угодно (выписка
    // анонимна), а молчаливое одобрение за вошедшего — та самая дыра
    // device-code phishing (разбор 2026-08-31). Одобрение живёт на экране
    // сверки `/auth/confirm`, куда клиент уводит человека сам, если вход
    // начинался в отдельном контейнере.
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // Неверный код — след в аудите (userId + ip). Бросает сервис
  // (UnauthorizedException 'Invalid code'); прочие ошибки (setup не начат и т.п.)
  // — не попытка подбора, их не пишем.
  private async logTotpFailure<T>(
    req: Request,
    userId: bigint,
    route: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        this.logTotpFailed(req, userId, route);
      }
      throw err;
    }
  }

  private logTotpFailed(req: Request, userId: bigint, route: string): void {
    this.securityLog.log('totp_failed', { userId, ip: req.ip, route });
  }
}
