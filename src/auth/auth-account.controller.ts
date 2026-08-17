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
import { EmailTokenService } from './email-token.service';
import {
  EmailBodyDto,
  TokenBodyDto,
  InitDataBodyDto,
} from './dto/auth-scalar.dto';
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
    private readonly emailTokens: EmailTokenService,
  ) {}

  // ─── Email magic-link login ───────────────────────────────────────────────

  @Post('email/link')
  @Throttle({
    short: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async emailLoginLink(
    @Body() dto: EmailBodyDto,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    requireCsrf(req, 'email/link', this.securityLog);
    return this.auth.requestEmailLogin(dto.email);
  }

  @Get('email/callback')
  async emailLoginCallback(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendBase = this.config.getOrThrow<string>('WEBAPP_URL');
    try {
      const r = await this.emailTokens.consumeEmailToken(
        token,
        req.ip,
        req.headers['user-agent'],
      );
      // 2FA-гейт (H1): login при включённом TOTP → экран ввода кода, не сессия.
      if (r.kind === 'totp_challenge') {
        res.redirect(
          `${frontendBase}/auth/2fa?token=${encodeURIComponent(r.challengeToken)}`,
        );
        return;
      }
      res.cookie(
        REFRESH_COOKIE,
        r.tokens.refreshToken,
        cookieOptions(30 * 24 * 3600),
      );
      res.redirect(
        r.purpose === 'link_email_auth'
          ? `${frontendBase}/account?linked=email`
          : `${frontendBase}/auth/callback#access_token=${r.tokens.accessToken}&expires_in=${r.tokens.expiresIn}`,
      );
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
    @Body() dto: EmailBodyDto,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    requireCsrf(req, 'email/link-to-account', this.securityLog);
    const webUser: WebUser = req.webUser!;
    return this.auth.linkEmailToAccount(webUser.userId, dto.email);
  }

  // ─── Telegram WebApp initData (mini-app auto-auth) ────────────────────────

  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @Post('telegram/webapp')
  @HttpCode(200)
  async telegramWebApp(
    @Body() dto: InitDataBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const { initData } = dto;
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
    @Body() dto: TokenBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const { token } = dto;
    // CSRF: require the custom header same way refresh/logout do. Browser
    // cannot set it from a cross-origin form/img.
    requireCsrf(req, 'merge', this.securityLog);
    if (!token) throw new BadRequestException('Missing merge token');
    const { target, source, provider, providerId } =
      this.auth.verifyMergeToken(token);

    // Security: caller must be the target (JWT session) OR anonymous via the
    // OAuth callback that just minted this token (merge token = signed proof of
    // intent). Reject only if logged in as a DIFFERENT user.
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
        'Не удалось объединить аккаунты. Админ уведомлён — стоит попробовать позже.',
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
