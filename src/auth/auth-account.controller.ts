import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  Param,
  UnauthorizedException,
  BadRequestException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard, OptionalJwtGuard, WebUser } from './jwt.guard';
import { AuthProviderRegistry } from './providers/registry';
import { MergeService } from './merge.service';
import { SecurityLogService } from './security-log.service';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE, cookieOptions, requireCsrf } from './auth-http.util';

@Controller('api/auth')
export class AuthAccountController {
  private readonly logger = new Logger(AuthAccountController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly providers: AuthProviderRegistry,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // ─── Email magic-link login ───────────────────────────────────────────────

  @Post('email/link')
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async emailLoginLink(
    @Body('email') email: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    requireCsrf(req, 'email/link', this.securityLog);
    return this.auth.requestEmailLogin(email);
  }

  @Get('email/callback')
  async emailLoginCallback(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const { tokens, purpose } = await this.auth.consumeEmailToken(
        token,
        req.ip,
        req.headers['user-agent'],
      );
      res.cookie(
        REFRESH_COOKIE,
        tokens.refreshToken,
        cookieOptions(30 * 24 * 3600),
      );
      if (purpose === 'link_email_auth') {
        // Already logged in — go back to account with success banner
        res.redirect(`${frontendBase}/account?linked=email`);
      } else {
        res.redirect(
          `${frontendBase}/auth/callback#access_token=${tokens.accessToken}&expires_in=${tokens.expiresIn}`,
        );
      }
    } catch (err) {
      this.logger.error(`Email callback: ${(err as Error).message}`);
      res.redirect(`${frontendBase}/auth/error?reason=email_link_expired`);
    }
  }

  // ─── Link email to existing account ──────────────────────────────────────

  @Post('email/link-to-account')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async emailLinkToAccount(
    @Body('email') email: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    requireCsrf(req, 'email/link-to-account', this.securityLog);
    const webUser: WebUser = req.webUser!;
    return this.auth.linkEmailToAccount(webUser.userId, email);
  }

  // ─── Telegram WebApp initData (mini-app auto-auth) ────────────────────────

  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @Post('telegram/webapp')
  @HttpCode(200)
  async telegramWebApp(
    @Body('initData') initData: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!initData) throw new BadRequestException('Missing initData');
    const { id: telegramId, firstName } =
      this.auth.verifyTelegramWebAppData(initData);
    const userId = await this.auth.findOrCreateUserByProvider(
      'telegram',
      String(telegramId),
      firstName,
    );
    const tokens = await this.auth.issueTokens(
      userId,
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // CSRF: require the custom header same way refresh/logout do. Browser
    // cannot set it from a cross-origin form/img.
    requireCsrf(req, 'merge', this.securityLog);
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

  // ─── Link an additional provider (Telegram widget → existing account) ────

  @Post('link/:provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async linkProvider(
    @Param('provider') provider: string,
    // Не DTO: подписанный Telegram-payload, whitelist срежет поля и сломает hash-верификацию.
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<
    | { ok: true }
    | { merge: true; mergeToken: string; summary: Record<string, number> }
  > {
    const handler = this.providers.get(provider);
    if (!handler.verifyClientData) {
      throw new BadRequestException(
        `Provider ${provider} doesn't support direct linking — use OAuth flow`,
      );
    }
    const identity = handler.verifyClientData(body);
    const webUser: WebUser = req.webUser!;

    const result = await this.auth.linkProviderToUser(
      webUser.userId,
      provider,
      identity.providerId,
      identity.displayName,
      identity.email,
    );
    if (result.ok) return { ok: true };

    // Conflict — give the UI a merge token.
    const sourceId = BigInt(result.conflictUserId);
    const mergeToken = this.auth.buildMergeToken(
      webUser.userId,
      sourceId,
      provider,
      identity.providerId,
    );
    const summary = await this.merge.summarize(sourceId);
    return { merge: true, mergeToken, summary };
  }

  // ─── Unlink a provider ────────────────────────────────────────────────────

  @Post('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async unlink(
    @Param('provider') provider: string,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    if (!this.providers.list().some((p) => p.id === provider)) {
      throw new BadRequestException('Unknown provider');
    }
    const webUser: WebUser = req.webUser!;
    await this.auth.unlinkProvider(webUser.userId, provider);
    this.securityLog.log('provider_unlinked', {
      userId: webUser.userId,
      provider,
      ip: req.ip,
    });
    return { ok: true };
  }
}
