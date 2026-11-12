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
import { ConfigService } from '@nestjs/config';
import { OptionalJwtGuard } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import type { Request, Response } from 'express';
import { VkProvider } from './providers/vk.provider';
import { fromVkState } from './providers/vk-state';
import { takeVkPkceVerifier } from './vk-pkce';
import { AuthFlowService } from './auth-flow.service';
import {
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  assertOAuthStateMatches,
} from './oauth-host';
import { oauthErrorCode } from './oauth-error-code';

@Controller('api/auth')
export class AuthOauthController {
  private readonly logger = new Logger(AuthOauthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly flow: AuthFlowService,
  ) {}

  // ─── VK OAuth ─────────────────────────────────────────────────────────────

  @Get('vk')
  @UseGuards(OptionalJwtGuard)
  vkRedirect(@Req() req: Request, @Res() res: Response): void {
    return this.flow.oauthRedirect('vk', req, res);
  }

  @Get('vk/callback')
  async vkCallback(
    @Query('code') code: string,
    @Query('state') vkState: string,
    @Query('device_id') deviceId: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    // VK ID: обмен требует device_id + PKCE (верификатор — кука шага 1, vk-pkce.ts).
    // state ушёл к VK в base64url (VK режет точки JWT) — см. vk-state.ts.
    const state = vkState ? fromVkState(vkState) : vkState;
    try {
      const vk = this.providers.get('vk') as VkProvider;
      if (error)
        throw new UnauthorizedException(
          `vk auth denied: ${oauthErrorCode(error)}`,
        );
      if (!code || !state || !deviceId)
        throw new BadRequestException('Missing code / state / device_id');
      assertOAuthStateMatches(req, state, vk.callbackOrigin());
      res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });
      const identity = await vk.exchangeCodeWithContext(code, deviceId, {
        state,
        verifier: takeVkPkceVerifier(req, res),
      });
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
}
