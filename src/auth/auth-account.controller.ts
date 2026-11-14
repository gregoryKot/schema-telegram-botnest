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
import { EmailTokenService } from './email-token.service';
import { buildMergePreview, type MergePreview } from './merge-preview';
import { SecurityNoticeService } from './security-notice.service';
import { StepUpGuard } from './step-up';
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
import { AnalyticsService } from '../analytics/analytics.service';
import { messengerLaunchMeta } from '../analytics/launch-platforms.constants';
import { failureSinks, reportExchangeFailure } from './exchange-failure.report';
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
    private readonly notice: SecurityNoticeService,
    private readonly analytics: AnalyticsService,
  ) {}

  // ─── Привязка почты: ссылка из письма ─────────────────────────────────────

  // Ссылка из письма привязки (B-14): только 302 на страницу сайта, токен не
  // гасится — его гасит POST email/consume. См. email-callback-redirect.ts.
  @Get('email/callback')
  emailCallback(@Query('token') token: unknown, @Res() res: Response): void {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const base = this.config.getOrThrow<string>('WEBAPP_URL');
    res.redirect(302, emailCallbackRedirectUrl(base, token));
  }

  // Погашение токена привязки со страницы сайта. Анонимный роут (чья сессия —
  // решает refresh-кука, A3), но с CSRF-заголовком и троттлингом; токен — 256
  // бит, лимит против шума. Сессию не выдаёт.
  @Post('email/consume')
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 40, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async emailConsume(
    @Body() dto: TokenBodyDto,
    @Req() req: Request,
  ): Promise<{ linked: true }> {
    requireCsrf(req, 'email/consume', this.securityLog);
    const userId = await this.emailTokens.consumeEmailToken(
      dto.token,
      await this.identity.resolve(req), // A3: чья сессия в этом браузере
    );
    this.notice.linked(userId, 'email');
    return { linked: true };
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
    // IP — троттлинг алерта о подделке (rejectInitData) и строки отказа входа
    // в /stats. Нет BOT_TOKEN — наша конфигурация: в отказы входа не идёт.
    const sinks = failureSinks(this.analytics);
    const tg = this.auth.verifyTelegramWebAppData(initData, req.ip, (err) =>
      reportExchangeFailure(err, 'telegram', dto.platform, req.ip, sinks),
    );
    const userId = await this.auth.findOrCreateUserByProvider(
      'telegram',
      String(tg.id),
      tg.firstName,
    );
    const ua = req.headers['user-agent'];
    const tokens = await this.auth.issueTokens(userId, req.ip, ua);
    // Telegram Web (Web A/K) грузит мини-апп в iframe, как MAX: strict-кука
    // там не продлевается (2026-08-21). Нативное вебвью остаётся на strict.
    const webappUrl = this.config.getOrThrow<string>('WEBAPP_URL');
    const crossSite = isCrossSiteRequest(req, webappUrl);
    setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, crossSite);
    // Платформа запуска — server-events.constants.ts; track() не бросает.
    const meta = messengerLaunchMeta('telegram', dto.platform);
    void this.analytics.track(null, 'messenger_launch', meta);
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
