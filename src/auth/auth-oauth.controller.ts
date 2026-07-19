import {
  Controller,
  Get,
  Req,
  Res,
  Query,
  UnauthorizedException,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OptionalJwtGuard } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import type { Request, Response } from 'express';
import { VkProvider } from './providers/vk.provider';
import { TelegramOidcProvider } from './providers/telegram-oidc.provider';
import { AuthFlowService } from './auth-flow.service';
import { getCookie } from './auth-http.util';

@Controller('api/auth')
export class AuthOauthController {
  private readonly logger = new Logger(AuthOauthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly flow: AuthFlowService,
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

      const savedState = getCookie(req, 'oauth_state');
      if (!savedState || savedState !== state)
        throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const identity = await vk.exchangeCodeWithContext(code, deviceId, state);

      const linkUserId = this.flow.linkUserIdFromState(state);

      const outcome = await this.flow.signInOrLinkOrMerge('vk', identity, {
        linkUserId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      this.flow.finishOAuthRedirect(outcome, 'vk', res, frontendBase);
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
    const state = Buffer.from(
      JSON.stringify({
        nonce: randomBytes(16).toString('hex'),
        linkUserId: req.webUser?.userId?.toString() ?? null,
      }),
    ).toString('base64url');
    const { verifier, challenge } = provider.generatePkce();
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth',
    });
    res.cookie('tg_pkce_verifier', verifier, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth',
    });
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

      const savedState = getCookie(req, 'oauth_state');
      if (!savedState || savedState !== state)
        throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const codeVerifier = getCookie(req, 'tg_pkce_verifier');
      if (!codeVerifier)
        throw new UnauthorizedException('Missing PKCE verifier');
      res.clearCookie('tg_pkce_verifier', { path: '/api/auth' });

      const provider = this.providers.get(
        'telegram-oidc',
      ) as TelegramOidcProvider;
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
      );
    } catch (err) {
      this.logger.error(
        `telegram-oidc callback error: ${(err as Error).message}`,
      );
      res.redirect(`${frontendBase}/auth/error?reason=telegram_oidc_failed`);
    }
  }
}
