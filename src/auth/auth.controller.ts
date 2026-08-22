import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  UnauthorizedException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard, WebUser } from './jwt.guard';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import type { Request, Response } from 'express';
import {
  CROSS_SITE_COOKIE,
  REFRESH_COOKIE,
  getCookie,
  isCrossSiteSession,
  requireCsrf,
  setRefreshCookie,
} from './auth-http.util';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly securityLog: SecurityLogService,
    private readonly totp: TotpService,
  ) {}

  // ─── Token refresh ─────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(200)
  // IP-бакет без Authorization бьёт по NAT сильнее дефолта (2026-08-21).
  @Throttle({
    short: { limit: 20, ttl: 1000 },
    long: { limit: 600, ttl: 60_000 },
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    requireCsrf(req, 'refresh', this.securityLog);
    const rawRefresh = getCookie(req, REFRESH_COOKIE);
    if (!rawRefresh) throw new UnauthorizedException('No refresh token');
    const tokens = await this.auth.rotateRefreshToken(
      rawRefresh,
      req.ip,
      req.headers['user-agent'],
    );
    // rotated:false → кука не переставляется (refresh-rotation.ts).
    if (tokens.rotated) {
      setRefreshCookie(
        res,
        tokens.refreshToken,
        30 * 24 * 3600,
        isCrossSiteSession(req),
      );
    }
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Query('all') all: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean }> {
    requireCsrf(req, 'logout', this.securityLog);
    const rawRefresh = getCookie(req, REFRESH_COOKIE);
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
    res.clearCookie(CROSS_SITE_COOKIE, { path: '/api/auth' });
    return { ok: true };
  }

  // ─── Current user info ─────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request): Promise<{
    userId: string;
    providers: Array<{
      provider: string;
      email: string | null;
      displayName: string | null;
    }>;
    totp: { enabled: boolean; recoveryCodesLeft: number };
  }> {
    const webUser: WebUser = req.webUser!;
    const [providers, totp] = await Promise.all([
      this.auth.getUserProviders(webUser.userId),
      this.totp.getStatus(webUser.userId),
    ]);
    return { userId: String(webUser.userId), providers, totp };
  }

  // ─── Issue a short-lived link token for the mini-app ─────────────────────
  // Мини-апп аутентифицируется `x-telegram-init-data`, а не JWT — этот токен
  // даёт ему JWT для запуска Google/OAuth-линковки (`?link_token=`). JWT-
  // guarded зеркало для веба монтируется отдельно в api.controller.ts.

  @Get('link-token')
  @UseGuards(JwtAuthGuard)
  issueLinkToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { linkToken: string; expiresIn: number } {
    const webUser: WebUser = req.webUser!;
    const linkToken = this.auth.buildLinkToken(webUser.userId);
    // Основной канал — httpOnly-cookie (S-4); тело ответа для старых клиентов.
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
