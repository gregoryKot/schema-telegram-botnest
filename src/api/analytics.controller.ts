import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { uid } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import {
  TrackEventDto,
  SHARE_CARD_KIND_SET,
  CRISIS_SURFACE_SET,
  TODAY_FOCUS_PRACTICE_SET,
} from './dto/analytics.dto';

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
  if (name === 'share_result') {
    const kind = meta.kind;
    const ok = meta.ok;
    if (
      typeof kind === 'string' &&
      SHARE_CARD_KIND_SET.has(kind) &&
      typeof ok === 'boolean'
    ) {
      return { kind, ok };
    }
    return undefined;
  }
  if (name === 'crisis_card_shown' || name === 'crisis_hotline_tapped') {
    const surface = meta.surface;
    if (typeof surface === 'string' && CRISIS_SURFACE_SET.has(surface)) {
      return { surface };
    }
    return undefined;
  }
  if (name === 'outbox_flush') {
    const count = meta.count;
    // Только положительное целое, с потолком — защита от мусора/переполнения.
    if (typeof count === 'number' && Number.isInteger(count) && count > 0) {
      return { count: Math.min(count, 1000) };
    }
    return undefined;
  }
  if (name === 'today_focus_change') {
    const practice = meta.practice;
    if (
      typeof practice === 'string' &&
      TODAY_FOCUS_PRACTICE_SET.has(practice)
    ) {
      return { practice };
    }
    return undefined;
  }
  if (name === 'today_streak_toggle') {
    const hidden = meta.hidden;
    if (typeof hidden === 'boolean') {
      return { hidden };
    }
    return undefined;
  }
  // breath_start — без meta; любые поля отбрасываются.
  return undefined;
}
