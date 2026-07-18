import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { uid } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { TrackEventDto, SHARE_CARD_KIND_SET } from './dto/analytics.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Приём продуктовых событий с фронтендов (правило №8). Идентичность —
// верифицированная (TelegramAuthGuard), поэтому троттлинг per-user (правило
// №5): 120 событий/мин на юзера с запасом под серию шэров, но не даёт заспамить.
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
    // Санитизация meta: пропускаем ТОЛЬКО известные поля конкретного события,
    // чтобы в БД не утёк произвольный (потенциально PII) объект с клиента.
    const meta = sanitizeMeta(body.name as AnalyticsEventName, body.meta);
    await this.analytics.track(uid(req), body.name as AnalyticsEventName, meta);
    return { ok: true };
  }
}

function sanitizeMeta(
  name: AnalyticsEventName,
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  if (name === 'share_card') {
    const kind = meta.kind;
    if (typeof kind === 'string' && SHARE_CARD_KIND_SET.has(kind)) {
      return { kind };
    }
    return undefined;
  }
  return undefined;
}
