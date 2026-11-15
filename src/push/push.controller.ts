// Ручки уведомлений в приложении (контракт с сайтом: shared/src/apiTypes.ts).
// Идентичность — проверенная подпись (TelegramAuthGuard), бакет лимита — на
// человека (правило №5); счётчик в памяти — решение в
// scripts/persistent-throttle-baseline.json (ручки не денежные, не
// заявочные, кода не проверяют). Исключение — rotate: у воркера сайта нет
// сессии (ANONYMOUS_BY_DESIGN), бакет по IP, счётчик в Postgres.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import { uid, type AuthRequest } from '../api/request-utils';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { PushService } from './push.service';
import type { PushKeys } from './push-subscription.store';
import {
  PushEndpointDto,
  PushRotateDto,
  PushSubscriptionDto,
  PushUnsubscribeDto,
} from './push.dto';

const keysOf = (s: PushSubscriptionDto): PushKeys => ({
  endpoint: s.endpoint,
  p256dh: s.keys.p256dh,
  auth: s.keys.auth,
});

@Controller('api/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** null — VAPID на сервере не задан: сайт не предлагает включить. */
  @Get('config')
  @UseGuards(TelegramAuthGuard)
  config(): { publicKey: string | null } {
    return { publicKey: this.push.publicKey() };
  }

  @Post('subscription')
  @UseGuards(TelegramAuthGuard)
  @Throttle({ long: { limit: 20, ttl: 3_600_000 } })
  async subscribe(
    @Req() req: AuthRequest,
    @Body() body: PushSubscriptionDto,
  ): Promise<{ ok: true; delivered: boolean }> {
    const { delivered } = await this.push.subscribe(uid(req), keysOf(body));
    return { ok: true, delivered };
  }

  @Post('unsubscribe')
  @UseGuards(TelegramAuthGuard)
  @Throttle({ long: { limit: 30, ttl: 3_600_000 } })
  async unsubscribe(
    @Req() req: AuthRequest,
    @Body() body: PushUnsubscribeDto,
  ): Promise<{ ok: true }> {
    await this.push.unsubscribe(uid(req), body.endpoint, body.reason ?? 'user');
    return { ok: true };
  }

  /** Сверка строки «На этом устройстве»: знает ли сервер подписку браузера. */
  @Post('status')
  @UseGuards(TelegramAuthGuard)
  @HttpCode(HttpStatus.OK)
  async status(
    @Req() req: AuthRequest,
    @Body() body: PushEndpointDto,
  ): Promise<{ known: boolean }> {
    return { known: await this.push.isKnown(uid(req), body.endpoint) };
  }

  /** Подписка, которую браузер сменил сам: шлёт воркер (webapp/public/sw.js). */
  @Post('rotate')
  @HttpCode(HttpStatus.OK)
  @PersistentThrottleLimit({ long: { limit: 20, ttl: 3_600_000 } })
  async rotate(@Body() body: PushRotateDto): Promise<{ ok: true }> {
    await this.push.rotate(body.oldEndpoint, keysOf(body.subscription));
    return { ok: true };
  }
}
