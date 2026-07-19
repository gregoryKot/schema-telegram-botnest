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
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { OptionalJwtGuard } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import { SecurityLogService } from './security-log.service';
import type { Request, Response } from 'express';
import { AuthFlowService } from './auth-flow.service';
import {
  REFRESH_COOKIE,
  cookieOptions,
  getCookie,
  requireCsrf,
} from './auth-http.util';

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
      try {
        linkUserId = BigInt(tgLinkCookie);
      } catch {
        /* ignore */
      }
    }
    res.clearCookie('tg_link_user', { path: '/api/auth' });

    const outcome = await this.flow.signInOrLinkOrMerge('telegram', identity, {
      linkUserId: linkUserId ? BigInt(String(linkUserId)) : null,
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
    res.cookie(
      REFRESH_COOKIE,
      outcome.tokens.refreshToken,
      cookieOptions(30 * 24 * 3600),
    );
    return {
      accessToken: outcome.tokens.accessToken,
      expiresIn: outcome.tokens.expiresIn,
    };
  }

  // ─── Telegram Login Widget — redirect flow ───────────────────────────────
  // Full-page redirect to oauth.telegram.org (no iframe, no domain setup in
  // BotFather required). User authorizes in Telegram's own page, then comes
  // back to widget-redirect with the signed user data as query params.

  @Get('telegram/redirect')
  @UseGuards(OptionalJwtGuard)
  telegramRedirect(@Req() req: Request, @Res() res: Response): void {
    const botToken = this.config.getOrThrow<string>('BOT_TOKEN').trim();
    const botId = botToken.split(':')[0]; // BOT_TOKEN format: 123456789:HASH
    const frontendBase = this.config
      .getOrThrow<string>('WEBAPP_URL')
      .replace(/\/$/, '');
    // Return to the frontend SPA page that reads the hash fragment.
    // oauth.telegram.org puts auth data in #tgAuthResult=BASE64URL_JSON (hash fragment),
    // which browsers never send to the server. The frontend page reads window.location.hash
    // and calls /api/auth/telegram/widget directly.
    const returnTo = `${frontendBase}/auth/telegram`;
    // Persist linkUserId in a short-lived cookie so we can restore it after redirect
    const linkUserId = req.webUser?.userId?.toString() ?? null;
    if (linkUserId) {
      res.cookie('tg_link_user', linkUserId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/api/auth',
      });
    }
    const url = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(frontendBase)}&return_to=${encodeURIComponent(returnTo)}&request_access=write&lang=ru&embed=0`;
    res.redirect(url);
  }

  @Get('telegram/widget-redirect')
  async telegramWidgetRedirect(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');

    // oauth.telegram.org/auth?embed=0 sends auth data in the URL *hash fragment*
    // (#tgAuthResult=BASE64URL_JSON), which browsers never send to the server.
    // When we receive a request with no query params, serve a tiny HTML trampoline
    // that reads the hash client-side and bounces back with the data as a query param.
    if (Object.keys(query).length === 0) {
      res.type('text/html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Вход через Telegram...</title></head><body>
<script>
try {
  var h = window.location.hash.slice(1);
  var p = new URLSearchParams(h);
  var r = p.get('tgAuthResult');
  if (r) {
    window.location.replace(window.location.pathname + '?tgAuthResult=' + encodeURIComponent(r));
  } else {
    window.location.replace('/auth/error?reason=telegram_no_data');
  }
} catch(e) {
  window.location.replace('/auth/error?reason=telegram_fragment_error');
}
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:40px">Загрузка...</p>
</body></html>`);
      return;
    }

    try {
      const telegramHandler = this.providers.get('telegram');
      if (!telegramHandler.verifyClientData)
        throw new BadRequestException('Telegram provider missing');

      // oauth.telegram.org/auth?embed=0 may also return data as a query param:
      //   ?tgAuthResult=BASE64URL_JSON  (wrapped format)
      //   ?id=...&hash=...             (flat Login Widget format)
      // Detect and normalise to plain fields before passing to verifyClientData.
      let fields: Record<string, string> = { ...query };
      if (query['tgAuthResult']) {
        try {
          const decoded = JSON.parse(
            Buffer.from(query['tgAuthResult'], 'base64url').toString('utf8'),
          ) as Record<string, string | number | boolean | null>;
          fields = {};
          for (const [k, v] of Object.entries(decoded)) {
            if (v != null) fields[k] = String(v);
          }
          this.logger.debug(
            `telegram widget-redirect: decoded tgAuthResult, id=${fields['id']}`,
          );
        } catch (e) {
          throw new UnauthorizedException(
            `Failed to decode tgAuthResult: ${(e as Error).message}`,
          );
        }
      }

      const identity = telegramHandler.verifyClientData(fields);

      const savedLinkUserId = getCookie(req, 'tg_link_user') ?? null;
      res.clearCookie('tg_link_user', { path: '/api/auth' });
      const linkUserId = savedLinkUserId ? BigInt(savedLinkUserId) : null;

      const outcome = await this.flow.signInOrLinkOrMerge(
        'telegram',
        identity,
        {
          linkUserId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      );
      this.flow.finishOAuthRedirect(outcome, 'telegram', res, frontendBase);
    } catch (err) {
      const msg = (err as Error).message ?? 'unknown';
      this.logger.error(
        `telegram widget-redirect error: ${msg} | query keys=${JSON.stringify(Object.keys(query))}`,
      );
      res.redirect(
        `${frontendBase}/auth/error?reason=${encodeURIComponent(msg)}`,
      );
    }
  }
}
