import { Controller, Get, Req, Res, Query, UseGuards } from '@nestjs/common';
import { OptionalJwtGuard } from './jwt.guard';
import type { Request, Response } from 'express';
import { VkProvider } from './providers/vk.provider';
import { fromVkState } from './providers/vk-state';
import { takeVkPkceVerifier } from './vk-pkce';
import { AuthFlowService } from './auth-flow.service';
import { OAuthCallbackService } from './oauth-callback.service';
import { OAuthCallbackQueryDto } from './dto/oauth-callback.dto';

// Вход через внешние сервисы. Старт — общий AuthFlowService.oauthRedirect,
// возврат — общий хвост OAuthCallbackService.complete (сверка state, вход или
// привязка, экран по исходу, отказ → `<id>_failed`). Здесь — только то, чем
// площадки различаются: параметры адреса возврата и обмен кода.
@Controller('api/auth')
export class AuthOauthController {
  constructor(
    private readonly flow: AuthFlowService,
    private readonly callback: OAuthCallbackService,
  ) {}

  // ─── VK OAuth ─────────────────────────────────────────────────────────────

  @Get('vk')
  @UseGuards(OptionalJwtGuard)
  vkRedirect(@Req() req: Request, @Res() res: Response): void {
    return this.flow.oauthRedirect('vk', req, res);
  }

  @Get('vk/callback')
  vkCallback(
    @Query('code') code: string,
    @Query('state') vkState: string,
    @Query('device_id') deviceId: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // VK ID: обмен требует device_id + PKCE (верификатор — кука шага 1, vk-pkce.ts).
    // state ушёл к VK в base64url (VK режет точки JWT) — см. vk-state.ts.
    const state = vkState ? fromVkState(vkState) : vkState;
    return this.callback.complete(
      'vk',
      req,
      res,
      { code, state, error, extra: { device_id: deviceId } },
      (vk, signedState) =>
        (vk as VkProvider).exchangeCodeWithContext(code, deviceId, {
          state: signedState,
          verifier: takeVkPkceVerifier(req, res),
        }),
    );
  }

  // ─── Яндекс ID ────────────────────────────────────────────────────────────
  // Обмен — штатный exchangeCode провайдера; state Яндекс возвращает как есть.

  @Get('yandex')
  @UseGuards(OptionalJwtGuard)
  yandexRedirect(@Req() req: Request, @Res() res: Response): void {
    return this.flow.oauthRedirect('yandex', req, res);
  }

  @Get('yandex/callback')
  yandexCallback(
    @Query() query: OAuthCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { code, state, error } = query;
    return this.callback.complete('yandex', req, res, { code, state, error });
  }
}
