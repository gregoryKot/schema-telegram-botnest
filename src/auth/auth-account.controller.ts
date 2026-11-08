import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Query,
  BadRequestException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import { CODE_THROTTLE, STRICT_THROTTLE } from './auth-throttles';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard, OptionalJwtGuard, WebUser } from './jwt.guard';
import { MergeService } from './merge.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogService } from './security-log.service';
import { emailCallbackRedirectUrl } from './email-callback-redirect';
import { emailConsumeBody, type EmailConsumeBody } from './email-consume-body';
import { EmailTokenService } from './email-token.service';
import { buildMergePreview, type MergePreview } from './merge-preview';
import { SecurityNoticeService } from './security-notice.service';
import { StepUpGuard } from './step-up';
import { TicketDeviceService } from './login-ticket/ticket-device';
import {
  EmailBodyDto,
  InitDataBodyDto,
  TokenBodyDto,
} from './dto/auth-scalar.dto';
import { MergeConfirmDto } from './dto/merge-confirm.dto';
import { CallerIdentityService } from './caller-identity';
import { TotpService } from './totp.service';
import {
  assertMergeCaller,
  assertSourceTotp,
  mergeOrThrow,
} from './merge-confirm';
import type { Request, Response } from 'express';
import {
  isCrossSiteRequest,
  requireCsrf,
  setRefreshCookie,
} from './auth-http.util';

@Controller('api/auth')
export class AuthAccountController {
  private readonly logger = new Logger(AuthAccountController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly merge: MergeService,
    private readonly securityLog: SecurityLogService,
    private readonly emailTokens: EmailTokenService,
    private readonly identity: CallerIdentityService,
    private readonly totp: TotpService,
    private readonly tickets: TicketDeviceService,
    private readonly notice: SecurityNoticeService,
  ) {}

  // ─── Email magic-link login ───────────────────────────────────────────────

  @Post('email/link')
  @PersistentThrottleLimit(STRICT_THROTTLE)
  @HttpCode(200)
  async emailLoginLink(
    @Body() dto: EmailBodyDto,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    requireCsrf(req, 'email/link', this.securityLog);
    // S9: чужой билет в письме — фишинг настоящим письмом (ticket-device.ts).
    if (dto.ticket) await this.tickets.assertOwnPendingLogin(req, dto.ticket);
    return this.auth.requestEmailLogin(dto.email, dto.ticket);
  }

  // Ссылка из письма (B-14): только 302 на страницу сайта, токен не гасится —
  // его гасит POST email/consume. См. email-callback-redirect.ts.
  @Get('email/callback')
  emailLoginCallback(
    @Query('token') token: unknown,
    @Query('ticket') ticket: unknown,
    @Res() res: Response,
  ): void {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.redirect(
      302,
      emailCallbackRedirectUrl(
        this.config.getOrThrow<string>('WEBAPP_URL'),
        typeof token === 'string' ? token : undefined,
        typeof ticket === 'string' ? ticket : undefined,
      ),
    );
  }

  // Погашение токена со страницы сайта. Анонимный роут (человек входит), но с
  // CSRF-заголовком и троттлингом; токен — 256 бит, лимит против шума.
  @Post('email/consume')
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 40, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async emailConsume(
    @Body() dto: TokenBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmailConsumeBody> {
    requireCsrf(req, 'email/consume', this.securityLog);
    const r = await this.emailTokens.consumeEmailToken(
      dto.token,
      req.ip,
      req.headers['user-agent'],
      await this.identity.resolve(req), // A3: чья сессия в этом браузере
    );
    if (r.kind === 'linked') this.notice.linked(r.userId, 'email');
    return emailConsumeBody(r, res);
  }

  // ─── Link email to existing account ──────────────────────────────────────

  @Post('email/link-to-account')
  @UseGuards(JwtAuthGuard, StepUpGuard) // S12: новый способ входа
  @PersistentThrottleLimit(STRICT_THROTTLE)
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
    requireCsrf(req, 'telegram/webapp', this.securityLog);
    const { initData } = dto;
    if (!initData) throw new BadRequestException('Missing initData');
    // IP — для троттлинга алерта о подделке подписи (rejectInitData).
    const tg = this.auth.verifyTelegramWebAppData(initData, req.ip);
    const userId = await this.auth.findOrCreateUserByProvider(
      'telegram',
      String(tg.id),
      tg.firstName,
    );
    const tokens = await this.auth.issueTokens(
      userId,
      req.ip,
      req.headers['user-agent'],
    );
    // Telegram Web (Web A/K) грузит мини-апп в iframe, как MAX: strict-кука
    // там не продлевается (2026-08-21). Нативное вебвью остаётся на strict.
    const crossSite = isCrossSiteRequest(
      req,
      this.config.getOrThrow<string>('WEBAPP_URL'),
    );
    setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, crossSite);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  // ─── Confirm a pending merge ──────────────────────────────────────────────

  // Экран /account/merge: имя и счётчики — отсюда, не из query (merge-preview.ts).
  @Post('merge/preview')
  @UseGuards(JwtAuthGuard)
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  mergePreview(
    @Body() dto: TokenBodyDto,
    @Req() req: Request,
  ): Promise<MergePreview> {
    requireCsrf(req, 'merge/preview', this.securityLog);
    const deps = { auth: this.auth, merge: this.merge, prisma: this.prisma };
    return buildMergePreview(deps, dto.token, req.webUser!.userId);
  }

  @Post('merge')
  @UseGuards(OptionalJwtGuard)
  @PersistentThrottleLimit(STRICT_THROTTLE)
  @HttpCode(200)
  async confirmMerge(
    @Body() dto: MergeConfirmDto,
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

    // Security (аудит 2026-10, A2/A4): merge-токен — не пропуск. Вызывающий
    // доказывает, что он target (Bearer или живая refresh-кука), а если у
    // поглощаемого аккаунта включён TOTP — ещё и вводит его код.
    assertMergeCaller(await this.identity.resolve(req), target);
    await assertSourceTotp(this.totp, source, dto.code);

    // 1. Move data from source → target.
    await mergeOrThrow(this.merge, this.logger, source, target);

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
    setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, false);
    this.securityLog.log('merge_confirmed', {
      target,
      source,
      provider,
      ip: req.ip,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }
}
