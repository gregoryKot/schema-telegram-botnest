import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  UnauthorizedException,
  BadRequestException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard, WebUser } from './jwt.guard';

const REFRESH_COOKIE = 'refresh_token';
const CSRF_HEADER = 'x-requested-with';

function cookieOptions(maxAgeS: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const, // same domain → CSRF impossible
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
  ) {}

  // ─── Google OAuth: initiate ────────────────────────────────────────────────

  @Get('google')
  googleRedirect(@Req() req: any, @Res() res: any): void {
    const state = Buffer.from(JSON.stringify({
      nonce: Math.random().toString(36).slice(2),
      linkUserId: (req as any).webUser?.userId?.toString() ?? null,
    })).toString('base64url');

    res.cookie('oauth_state', state, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 10 * 60 * 1000, path: '/api/auth' });
    res.redirect(this.auth.buildGoogleAuthUrl(state));
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      if (error) throw new UnauthorizedException('Google auth denied');
      if (!code || !state) throw new BadRequestException('Missing code or state');

      const savedState = req.cookies?.['oauth_state'];
      if (savedState && savedState !== state) throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const { googleId, email, name } = await this.auth.exchangeGoogleCode(code);

      let linkUserId: string | null = null;
      try { linkUserId = JSON.parse(Buffer.from(state, 'base64url').toString()).linkUserId ?? null; } catch {}

      let userId: bigint;
      if (linkUserId) {
        await this.auth.linkProviderToUser(BigInt(linkUserId), 'google', googleId, name, email);
        userId = BigInt(linkUserId);
      } else {
        userId = await this.auth.findOrCreateUserByProvider('google', googleId, name, email) as bigint;
      }

      const tokens = await this.auth.issueTokens(userId, req.ip, req.headers['user-agent']);
      res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(30 * 24 * 3600));
      res.redirect(`${frontendBase}/auth/callback#access_token=${tokens.accessToken}&expires_in=${tokens.expiresIn}`);
    } catch (err) {
      this.logger.error(`Google callback error: ${(err as Error).message}`);
      res.redirect(`${frontendBase}/auth/error?reason=google_failed`);
    }
  }

  // ─── Telegram Login Widget ─────────────────────────────────────────────────

  @Post('telegram/widget')
  @HttpCode(200)
  async telegramWidget(
    @Body() body: Record<string, string>,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const { id: telegramId, firstName } = this.auth.verifyTelegramWidgetData(body);
    const userId = await this.auth.findOrCreateUserByProvider('telegram', String(telegramId), firstName) as bigint;
    const tokens = await this.auth.issueTokens(userId, req.ip, req.headers['user-agent']);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(30 * 24 * 3600));
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Telegram WebApp auto-auth (initData) ─────────────────────────────────

  @Post('telegram/webapp')
  @HttpCode(200)
  async telegramWebApp(
    @Body('initData') initData: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!initData) throw new BadRequestException('Missing initData');
    const { id: telegramId, firstName } = this.auth.verifyTelegramWebAppData(initData);
    const userId = await this.auth.findOrCreateUserByProvider('telegram', String(telegramId), firstName) as bigint;
    const tokens = await this.auth.issueTokens(userId, req.ip, req.headers['user-agent']);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(30 * 24 * 3600));
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Link Telegram to existing account ────────────────────────────────────

  @Post('link/telegram')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async linkTelegram(
    @Body() body: Record<string, string>,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    const { id: telegramId, firstName } = this.auth.verifyTelegramWidgetData(body);
    const webUser: WebUser = req.webUser;
    await this.auth.linkProviderToUser(webUser.userId as bigint, 'telegram', String(telegramId), firstName);
    return { ok: true };
  }

  // ─── Token refresh ─────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!req.headers[CSRF_HEADER]) throw new UnauthorizedException('Missing CSRF header');
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
    if (!req.headers[CSRF_HEADER]) throw new UnauthorizedException('Missing CSRF header');
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
}
