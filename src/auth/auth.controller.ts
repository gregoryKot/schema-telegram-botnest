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
import { AuthService } from './auth.service';
import { JwtAuthGuard, WebUser } from './jwt.guard';
import { SecurityLogService } from './security-log.service';
import { TotpService } from './totp.service';
import type { Request, Response } from 'express';
import {
  REFRESH_COOKIE,
  cookieOptions,
  getCookie,
  requireCsrf,
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
  issueLinkToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { linkToken: string; expiresIn: number } {
    const webUser: WebUser = req.webUser!;
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
