import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  GoogleOneTapService,
  type OneTapLoginResult,
} from './google-one-tap.service';
import { GoogleOneTapDto } from './dto/google-one-tap.dto';
import { getCookie, requireCsrf } from './auth-http.util';
import { SecurityLogService } from './security-log.service';
import { GSI_NONCE_COOKIE, issueOneTapNonce } from './google-one-tap-nonce';

// Google One Tap: нативная всплывашка Google отдаёт id_token прямо в браузер
// (без редиректа). Вынесено из auth-oauth.controller.ts (правило №10: тот файл
// на потолке). Оба роута анонимные (сессии ещё нет): POST — с CSRF-заголовком
// и nonce-кукой (B-16 аудита 2026-10), оба — с троттлингом по IP. Только сайт:
// внутри мессенджеров One Tap не работает, там вход по initData.
@Controller('api/auth')
export class AuthOneTapController {
  constructor(
    private readonly oneTap: GoogleOneTapService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // Шаг 1: страница просит nonce перед показом всплывашки. Кука с секретом +
  // хеш в ответе (см. google-one-tap-nonce.ts).
  @Get('google/one-tap/nonce')
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 60, ttl: 3_600_000 },
  })
  nonce(@Res({ passthrough: true }) res: Response): { nonce: string } {
    res.set('Cache-Control', 'no-store');
    return issueOneTapNonce(res);
  }

  // Шаг 2: credential из GIS → своя сессия.
  @Post('google/one-tap')
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 40, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async googleOneTap(
    @Body() body: GoogleOneTapDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OneTapLoginResult> {
    requireCsrf(req, 'google/one-tap', this.securityLog);
    return this.oneTap.login(
      body.credential,
      getCookie(req, GSI_NONCE_COOKIE),
      res,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
