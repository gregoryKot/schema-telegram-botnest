import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Logger,
  HttpCode,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MaxProvider } from './providers/max.provider';
import { ProviderIdentity } from './providers/types';
import { SecurityLogService } from './security-log.service';
import { rejectInitData } from '../api/initdata-alert';
import { requireCsrf, setRefreshCookie } from './auth-http.util';
import { MaxNotConfiguredError } from './max-init-data';
import { MaxWebAppDto } from './dto/max-webapp.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { messengerLaunchMeta } from '../analytics/launch-platforms.constants';
import { failureSinks, reportExchangeFailure } from './exchange-failure.report';

// MAX mini-app auto-auth — как telegram/webapp (auth-account.controller.ts):
// initData меняется на сессию без аутентификации, поэтому requireCsrf (login-CSRF).
@Controller('api/auth')
export class AuthMaxController {
  private readonly logger = new Logger(AuthMaxController.name);

  constructor(
    private readonly maxProvider: MaxProvider,
    private readonly auth: AuthService,
    private readonly securityLog: SecurityLogService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Post('max/webapp')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async maxWebApp(
    @Body() body: MaxWebAppDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    requireCsrf(req, 'max/webapp', this.securityLog);
    if (!body?.initData) throw new BadRequestException('Missing initData');

    let identity: ProviderIdentity;
    try {
      identity = this.maxProvider.verifyInitData(body.initData);
    } catch (err) {
      // Нет токена — это мы не дособрали конфигурацию, а не клиент подделал
      // подпись: ни в rejectInitData, ни в отказы входа /stats её не отдаём.
      if (err instanceof MaxNotConfiguredError) {
        this.logger.error('вход из MAX недоступен: не задан MAX_BOT_TOKEN');
        throw new ServiceUnavailableException('MAX login is not configured');
      }
      const sinks = failureSinks(this.analytics);
      reportExchangeFailure(err, 'max', body.platform, req.ip, sinks);
      rejectInitData(err, req.ip, this.logger, this.securityLog);
    }

    const userId = await this.auth.findOrCreateUserByProvider(
      'max',
      identity.providerId,
      identity.displayName,
    );
    const ua = req.headers['user-agent'];
    const tokens = await this.auth.issueTokens(userId, req.ip, ua);
    // crossSite: MAX открывает мини-апп в iframe, и strict-куку браузер оттуда
    // не пошлёт — сессия перестала бы продлеваться через 15 минут.
    setRefreshCookie(res, tokens.refreshToken, 30 * 24 * 3600, true);
    // Платформа запуска — server-events.constants.ts; track() не бросает.
    const meta = messengerLaunchMeta('max', body.platform);
    void this.analytics.track(null, 'messenger_launch', meta);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }
}
