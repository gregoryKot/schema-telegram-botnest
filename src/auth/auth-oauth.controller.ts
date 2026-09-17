import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  Req,
  Res,
  Query,
  UnauthorizedException,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { OptionalJwtGuard } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import type { Request, Response } from 'express';
import { VkProvider } from './providers/vk.provider';
import { TelegramOidcProvider } from './providers/telegram-oidc.provider';
import { AuthFlowService } from './auth-flow.service';
import {
  GoogleOneTapService,
  type OneTapLoginResult,
} from './google-one-tap.service';
import { GoogleOneTapDto } from './dto/google-one-tap.dto';
import { getCookie, requireCsrf } from './auth-http.util';
import { SecurityLogService } from './security-log.service';
import {
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  setOAuthCookie,
  redirectToCallbackHost,
  assertOAuthStateMatches,
} from './oauth-host';

@Controller('api/auth')
export class AuthOauthController {
  private readonly logger = new Logger(AuthOauthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly flow: AuthFlowService,
    private readonly oneTap: GoogleOneTapService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(OptionalJwtGuard)
  googleRedirect(@Req() req: Request, @Res() res: Response): void {
    return this.flow.oauthRedirect('google', req, res);
  }

  // Authorization Code flow: Google redirects back with ?code=&state= via a
  // top-level GET. The generic helper exchanges the code server-side.
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.flow.oauthCallback('google', code, state, error, req, res);
  }

  // Google One Tap: нативная всплывашка Google отдаёт id_token прямо в браузер
  // (без редиректа). Фронт постит его сюда, мы проверяем токен тем же
  // верификатором, что и обмен кода, и выдаём свою сессию. Анонимный роут (у
  // человека сессии ещё нет), но с CSRF-заголовком — токен присылает JS нашего
  // origin, а не сторонний сайт, — и с троттлингом. Только сайт (host 'web'):
  // внутри мессенджеров One Tap не работает, там вход по initData.
  @Post('google/one-tap')
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 40, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async googleOneTap(
    @Body() body: GoogleOneTapDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OneTapLoginResult> {
    requireCsrf(req, 'google/one-tap', this.securityLog);
    return this.oneTap.login(
      body.credential,
      res,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ─── VK OAuth ─────────────────────────────────────────────────────────────

  @Get('vk')
  @UseGuards(OptionalJwtGuard)
  vkRedirect(@Req() req: Request, @Res() res: Response): void {
    return this.flow.oauthRedirect('vk', req, res);
  }

  @Get('vk/callback')
  async vkCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('device_id') deviceId: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // VK ID needs device_id + PKCE state for token exchange. Bypass the
    // generic helper and call the provider-specific method.
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const vk = this.providers.get('vk') as VkProvider;
      if (error) throw new UnauthorizedException(`vk auth denied: ${error}`);
      if (!code || !state || !deviceId)
        throw new BadRequestException('Missing code / state / device_id');

      assertOAuthStateMatches(req, state, vk.callbackOrigin());
      res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });

      const identity = await vk.exchangeCodeWithContext(code, deviceId, state);

      const linkUserId = this.flow.linkUserIdFromState(state);

      const outcome = await this.flow.signInOrLinkOrMerge('vk', identity, {
        linkUserId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      this.flow.finishOAuthRedirect(
        outcome,
        'vk',
        res,
        frontendBase,
        this.flow.ticketFromState(state),
      );
    } catch (err) {
      this.logger.error(`vk callback error: ${(err as Error).message}`);
      res.redirect(`${frontendBase}/auth/error?reason=vk_failed`);
    }
  }

  // ─── Telegram OIDC (new flow, PKCE) ──────────────────────────────────────

  @Get('telegram-oidc')
  @UseGuards(OptionalJwtGuard)
  telegramOidcRedirect(@Req() req: Request, @Res() res: Response): void {
    const provider = this.providers.get(
      'telegram-oidc',
    ) as TelegramOidcProvider;
    // Алиас-домен: кука, поставленная здесь, обязана жить на хосте колбэка —
    // иначе колбэк её не увидит (2026-09-08). Только для анонимного входа:
    // привязка редиректом на другой хост стала бы входом под другим аккаунтом.
    if (
      req.webUser?.userId == null &&
      redirectToCallbackHost(req, res, provider.callbackOrigin())
    )
      return;
    // Подписанный state (C1): linkUserId нельзя подделать, иначе привязка чужого
    // провайдера к аккаунту жертвы = захват. Единая точка — flow.buildLinkState.
    const state = this.flow.buildLinkState(req.webUser?.userId ?? null);
    const { verifier, challenge } = provider.generatePkce();
    setOAuthCookie(res, OAUTH_STATE_COOKIE, state);
    setOAuthCookie(res, 'tg_pkce_verifier', verifier);
    res.redirect(provider.buildAuthUrl(state, challenge));
  }

  @Get('telegram-oidc/callback')
  async telegramOidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      if (error)
        throw new UnauthorizedException(`Telegram OIDC auth denied: ${error}`);
      if (!code || !state)
        throw new BadRequestException('Missing code or state');

      const provider = this.providers.get(
        'telegram-oidc',
      ) as TelegramOidcProvider;
      assertOAuthStateMatches(req, state, provider.callbackOrigin());
      res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });

      const codeVerifier = getCookie(req, 'tg_pkce_verifier');
      if (!codeVerifier)
        throw new UnauthorizedException('Missing PKCE verifier');
      res.clearCookie('tg_pkce_verifier', { path: OAUTH_COOKIE_PATH });

      const identity = await provider.exchangeCodePkce(code, codeVerifier);

      const linkUserId = this.flow.linkUserIdFromState(state);

      const outcome = await this.flow.signInOrLinkOrMerge(
        'telegram-oidc',
        identity,
        {
          linkUserId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      );
      this.flow.finishOAuthRedirect(
        outcome,
        'telegram-oidc',
        res,
        frontendBase,
        this.flow.ticketFromState(state),
      );
    } catch (err) {
      this.logger.error(
        `telegram-oidc callback error: ${(err as Error).message}`,
      );
      res.redirect(`${frontendBase}/auth/error?reason=telegram_oidc_failed`);
    }
  }
}
