import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  BadRequestException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { OptionalJwtGuard } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import { SecurityLogService } from './security-log.service';
import type { Request, Response } from 'express';
import { AuthFlowService } from './auth-flow.service';
import { getCookie, requireCsrf, setRefreshCookie } from './auth-http.util';
import { telegramOauthLoginUrl } from './telegram-oauth-url';

@Controller('api/auth')
export class AuthTelegramController {
  private readonly logger = new Logger(AuthTelegramController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly securityLog: SecurityLogService,
    private readonly flow: AuthFlowService,
  ) {}

  // ─── Telegram Login Widget ────────────────────────────────────────────────

  @Post('telegram/widget')
  @UseGuards(OptionalJwtGuard)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async telegramWidget(
    // Не DTO: подписанный Telegram-payload, whitelist срежет поля и сломает hash-верификацию.
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | {
        merge: true;
        mergeToken: string;
        summary: Record<string, number>;
        otherDisplay: string | null;
        provider: string;
      }
    | { totp: true; challengeToken: string }
    | { accessToken: string; expiresIn: number }
  > {
    requireCsrf(req, 'telegram/widget', this.securityLog);
    const telegramHandler = this.providers.get('telegram');
    if (!telegramHandler.verifyClientData)
      throw new BadRequestException(
        'Telegram provider does not support direct verification',
      );
    const identity = telegramHandler.verifyClientData(body);

    // JWT-based link (inline widget inside the app) takes priority.
    // Cookie-based link is used by the redirect flow: the user left the app
    // to authenticate on oauth.telegram.org, so the access token is gone but
    // the httpOnly tg_link_user cookie is still present.
    let linkUserId = req.webUser?.userId ?? null;
    const tgLinkCookie = getCookie(req, 'tg_link_user');
    if (!linkUserId && tgLinkCookie) {
      // Подпись проверяется (C1): сырой BigInt(cookie) давал подделку linkUserId.
      linkUserId = this.flow.readLinkState(tgLinkCookie);
    }
    res.clearCookie('tg_link_user', { path: '/api/auth' });

    const outcome = await this.flow.signInOrLinkOrMerge('telegram', identity, {
      linkUserId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (outcome.kind === 'merge') {
      return {
        merge: true,
        mergeToken: outcome.mergeToken,
        summary: outcome.summary,
        otherDisplay: outcome.otherDisplay,
        provider: 'telegram',
      };
    }
    if (outcome.kind === 'totp_challenge') {
      return { totp: true, challengeToken: outcome.challengeToken };
    }
    // crossSite:false — виджет постится с нашей же страницы (fetch), не iframe.
    setRefreshCookie(res, outcome.tokens.refreshToken, 30 * 24 * 3600, false);
    return {
      accessToken: outcome.tokens.accessToken,
      expiresIn: outcome.tokens.expiresIn,
    };
  }

  // ─── Telegram Login Widget — redirect flow ───────────────────────────────
  // Full-page redirect to oauth.telegram.org (no iframe). User authorizes in
  // Telegram's own page, then comes back to return_to (frontend
  // TelegramWidgetCallback.tsx — читает hash/query, разбирает все три
  // формата возврата и сама шлёт POST /api/auth/telegram/widget; серверный
  // GET /api/auth/telegram/widget-redirect, дублировавший эту логику, был
  // мёртвым кодом — return_to сюда никогда не вёл — и удалён, см. CLAUDE.md
  // правило №11).
  // ВАЖНО: домен обязан быть привязан к боту через /setdomain в BotFather —
  // без привязки oauth.telegram.org/auth отвечает голым текстом «Bot domain
  // invalid» (инцидент 2026-08-21: привязка слетела, вход был сломан у всех,
  // узнали от пользователя). За привязкой следит TelegramDomainWatchdogService.

  @Get('telegram/redirect')
  @UseGuards(OptionalJwtGuard)
  telegramRedirect(@Req() req: Request, @Res() res: Response): void {
    const botToken = this.config.getOrThrow<string>('BOT_TOKEN').trim();
    const botId = botToken.split(':')[0]; // BOT_TOKEN format: 123456789:HASH
    const frontendBase = this.config
      .getOrThrow<string>('WEBAPP_URL')
      .replace(/\/$/, '');
    // Return to the frontend SPA page that reads the hash fragment (built
    // inside telegramOauthLoginUrl as return_to). oauth.telegram.org puts
    // auth data in #tgAuthResult=BASE64URL_JSON (hash fragment), which
    // browsers never send to the server. The frontend page reads
    // window.location.hash and calls /api/auth/telegram/widget directly.
    // Persist linkUserId in a short-lived SIGNED cookie so we can restore it
    // after redirect. Signed (C1): a raw userId here was client-forgeable and
    // let an attacker link their Telegram to the victim's account.
    const linkUserId = req.webUser?.userId ?? null;
    if (linkUserId) {
      res.cookie('tg_link_user', this.flow.buildLinkState(linkUserId), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/api/auth',
      });
    }
    res.redirect(telegramOauthLoginUrl(botId, frontendBase));
  }
}
