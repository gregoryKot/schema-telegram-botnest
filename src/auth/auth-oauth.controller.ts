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
import { randomBytes } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OptionalJwtGuard } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import {
  AuthFlowService,
  REFRESH_COOKIE,
  cookieOptions,
} from './auth-flow.service';

// Redirect-based OAuth flows (Google, VK, Telegram OIDC), the Telegram Login
// Widget flows, and the merge-confirmation endpoint. Shares its base route
// prefix with AuthController — every path stays registered exactly once
// (guarded by scripts/check-route-collisions.mjs).
@Controller('api/auth')
export class AuthOAuthController {
  private readonly logger = new Logger(AuthOAuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
    private readonly flow: AuthFlowService,
  ) {}

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(OptionalJwtGuard)
  googleRedirect(@Req() req: any, @Res() res: any): void {
    return this.flow.oauthRedirect('google', req, res);
  }

  // Authorization Code flow: Google redirects back with ?code=&state= via a
  // top-level GET. The generic helper exchanges the code server-side.
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    return this.flow.oauthCallback('google', code, state, error, req, res);
  }

  // ─── VK OAuth ─────────────────────────────────────────────────────────────

  @Get('vk')
  @UseGuards(OptionalJwtGuard)
  vkRedirect(@Req() req: any, @Res() res: any): void {
    return this.flow.oauthRedirect('vk', req, res);
  }

  @Get('vk/callback')
  async vkCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('device_id') deviceId: string,
    @Query('error') error: string,
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    // VK ID needs device_id + PKCE state for token exchange. Bypass the
    // generic helper and call the provider-specific method.
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const vk = this.providers.get('vk') as any;
      if (error) throw new UnauthorizedException(`vk auth denied: ${error}`);
      if (!code || !state || !deviceId)
        throw new BadRequestException('Missing code / state / device_id');

      const savedState = req.cookies?.['oauth_state'];
      if (!savedState || savedState !== state)
        throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const identity = await vk.exchangeCodeWithContext(code, deviceId, state);

      let linkUserId: bigint | null = null;
      try {
        const raw = JSON.parse(
          Buffer.from(state, 'base64url').toString(),
        ).linkUserId;
        if (raw) linkUserId = BigInt(raw);
      } catch {
        /* ignore */
      }

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
  telegramOidcRedirect(@Req() req: any, @Res() res: any): void {
    const provider = this.providers.get('telegram-oidc') as any;
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
    @Req() req: any,
    @Res() res: any,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      if (error)
        throw new UnauthorizedException(`Telegram OIDC auth denied: ${error}`);
      if (!code || !state)
        throw new BadRequestException('Missing code or state');

      const savedState = req.cookies?.['oauth_state'];
      if (!savedState || savedState !== state)
        throw new UnauthorizedException('OAuth state mismatch');
      res.clearCookie('oauth_state', { path: '/api/auth' });

      const codeVerifier = req.cookies?.['tg_pkce_verifier'];
      if (!codeVerifier)
        throw new UnauthorizedException('Missing PKCE verifier');
      res.clearCookie('tg_pkce_verifier', { path: '/api/auth' });

      const provider = this.providers.get('telegram-oidc') as any;
      const identity = await provider.exchangeCodePkce(code, codeVerifier);

      let linkUserId: bigint | null = null;
      try {
        const raw = JSON.parse(
          Buffer.from(state, 'base64url').toString(),
        ).linkUserId;
        if (raw) linkUserId = BigInt(raw);
      } catch {
        /* ignore */
      }

      const outcome = await this.flow.signInOrLinkOrMerge(
        'telegram-oidc',
        identity,
        {
          linkUserId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      );
      this.flow.finishOAuthRedirect(outcome, 'telegram-oidc', res, frontendBase);
    } catch (err) {
      this.logger.error(
        `telegram-oidc callback error: ${(err as Error).message}`,
      );
      res.redirect(`${frontendBase}/auth/error?reason=telegram_oidc_failed`);
    }
  }

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
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<any> {
    this.flow.requireCsrf(req, 'telegram/widget');
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
    if (!linkUserId && req.cookies?.['tg_link_user']) {
      try {
        linkUserId = BigInt(req.cookies['tg_link_user']);
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
  telegramRedirect(@Req() req: any, @Res() res: any): void {
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
    @Req() req: any,
    @Res() res: any,
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
          ) as Record<string, unknown>;
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

      const savedLinkUserId = req.cookies?.['tg_link_user'] ?? null;
      res.clearCookie('tg_link_user', { path: '/api/auth' });
      const linkUserId = savedLinkUserId ? BigInt(savedLinkUserId) : null;

      const outcome = await this.flow.signInOrLinkOrMerge('telegram', identity, {
        linkUserId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
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

  // ─── Confirm a pending merge ──────────────────────────────────────────────

  @Post('merge')
  @UseGuards(OptionalJwtGuard)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async confirmMerge(
    @Body('token') token: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // CSRF: require the custom header same way refresh/logout do. Browser
    // cannot set it from a cross-origin form/img.
    this.flow.requireCsrf(req, 'merge');
    if (!token) throw new BadRequestException('Missing merge token');
    const { target, source, provider, providerId } =
      this.auth.verifyMergeToken(token);

    // Security: the caller MUST be authenticated as either:
    //   - the target user (started a link from an active session), OR
    //   - via the OAuth callback flow where the token was issued moments ago
    //     and the caller went directly from /auth/google/callback to /merge.
    //
    // For (1) we verify via JWT. For (2) we accept if no JWT is present
    // because the merge token itself is the proof of intent: it was just
    // issued to the same browser session and we trust the signed payload.
    // We do NOT accept if someone is logged in as a DIFFERENT user.
    const webUser = req.webUser;
    if (webUser && String(webUser.userId) !== String(target)) {
      throw new UnauthorizedException(
        'Merge token does not match current session',
      );
    }

    // 1. Move data from source → target.
    try {
      await this.merge.merge(source, target);
    } catch (err) {
      const msg = (err as Error).message ?? 'merge failed';
      // Full error → logs + admin alert (AlertLogger picks up .error).
      this.logger.error(
        `merge ${source} → ${target} failed: ${msg}`,
        (err as Error).stack,
      );
      // Friendly message to client — no Prisma internals leaked.
      throw new BadRequestException(
        'Не удалось объединить аккаунты. Админ уведомлён — попробуйте позже.',
      );
    }

    // 2. Link the provider that triggered the merge to the target user.
    const linkRes = await this.auth.linkProviderToUser(
      target,
      provider,
      providerId,
    );
    if (!linkRes.ok) {
      // Should be impossible — source's provider row was moved to target by
      // merge() above. Be defensive.
      throw new BadRequestException('Provider link failed after merge');
    }

    // 3. Issue fresh tokens for the target user.
    const tokens = await this.auth.issueTokens(
      target,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_COOKIE,
      tokens.refreshToken,
      cookieOptions(30 * 24 * 3600),
    );
    this.securityLog.log('merge_confirmed', {
      target,
      source,
      provider,
      ip: req.ip,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }
}
