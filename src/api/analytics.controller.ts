import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { uid } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { TrackEventDto } from './dto/analytics.dto';
import { sanitizeMeta } from './analytics-meta.sanitize';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Приём продуктовых событий с фронтендов (правило №8). Идентичность —
// верифицированная (TelegramAuthGuard), поэтому троттлинг per-user (правило
// №5): 120 событий/мин на юзера с запасом под серию шэров, но не даёт заспамить.
// Санитизация meta (sanitizeMeta) — отдельный модуль (правило №10), тестируется
// напрямую в analytics-meta.sanitize.spec.ts.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('event')
  @Throttle({ long: { limit: 120, ttl: 60_000 } })
  async track(
    @Req() req: AuthRequest,
    @Body() body: TrackEventDto,
  ): Promise<{ ok: true }> {
    const meta = sanitizeMeta(body.name as AnalyticsEventName, body.meta);
    await this.analytics.track(uid(req), body.name as AnalyticsEventName, meta);
    return { ok: true };
  }
}
