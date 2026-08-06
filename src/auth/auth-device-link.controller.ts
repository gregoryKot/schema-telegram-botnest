// Привязка аккаунта мессенджера к существующему: четыре шага RFC 8628.
// Логика — в DeviceLinkService, здесь только HTTP, охрана и троттлинг.
//
// Троттлинг тут важнее обычного. Короткий код можно перебирать, а флоу с
// кодом исторически ломают социальной инженерией («введите код для проверки
// безопасности») — так ходили в Microsoft 365 и в WhatsApp. Против перебора
// стоят лимиты ниже, против уговоров — экран preview, который показывает
// человеку, чей аккаунт и какие данные он сейчас отдаёт.
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { DeviceLinkService } from './device-link.service';
import type { LinkPreview } from './device-link.types';
import {
  DeviceCodeDto,
  StartDeviceLinkDto,
  UserCodeDto,
} from './dto/device-link.dto';
import {
  isCrossSiteSession,
  requireCsrf,
  setRefreshCookie,
} from './auth-http.util';
import { SecurityLogService } from './security-log.service';

const REFRESH_MAX_AGE_S = 30 * 24 * 3600;

@Controller('api/auth/device-link')
export class AuthDeviceLinkController {
  constructor(
    private readonly deviceLink: DeviceLinkService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // ─── Шаг 1: мини-апп просит коды ──────────────────────────────────────────
  @Post('start')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async start(
    @Body() body: StartDeviceLinkDto,
    @Req() req: Request,
  ): Promise<{
    deviceCode: string;
    userCode: string;
    expiresIn: number;
    interval: number;
  }> {
    return this.deviceLink.start(req.webUser!.userId, body.provider);
  }

  // ─── Шаг 2: браузер спрашивает, что произойдёт ────────────────────────────
  @Post('preview')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 60, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async preview(
    @Body() body: UserCodeDto,
    @Req() req: Request,
  ): Promise<LinkPreview> {
    return this.deviceLink.preview(body.code, req.webUser!.userId);
  }

  // ─── Шаг 3: человек подтвердил в браузере ─────────────────────────────────
  @Post('approve')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async approve(
    @Body() body: UserCodeDto,
    @Req() req: Request,
  ): Promise<{ merged: boolean }> {
    requireCsrf(req, 'device-link/approve', this.securityLog);
    return this.deviceLink.approve(body.code, req.webUser!.userId, req.ip);
  }

  // ─── Шаг 4: мини-апп забирает сессию ──────────────────────────────────────
  // Без JwtAuthGuard: длинный код и есть доказательство — так же устроен
  // token endpoint в RFC 8628. К моменту опроса аккаунт, под которым мини-апп
  // начинал, уже слит и его токен ничего не докажет.
  @Post('poll')
  @Throttle({
    short: { limit: 40, ttl: 60_000 },
    long: { limit: 200, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async poll(
    @Body() body: DeviceCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    status: string;
    accessToken?: string;
    expiresIn?: number;
  }> {
    const result = await this.deviceLink.poll(
      body.deviceCode,
      req.ip,
      req.headers['user-agent'],
    );
    if (result.status !== 'linked') return { status: result.status };

    setRefreshCookie(
      res,
      result.tokens.refreshToken,
      REFRESH_MAX_AGE_S,
      isCrossSiteSession(req),
    );
    return {
      status: 'linked',
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    };
  }
}
