// Ручки уведомлений в приложении (контракт с сайтом: shared/src/apiTypes.ts).
// Идентичность — проверенная подпись (TelegramAuthGuard), бакет лимита — на
// человека (правило №5); счётчик в памяти — решение в
// scripts/persistent-throttle-baseline.json (ручки не денежные, не
// заявочные, кода не проверяют).
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { uid, type AuthRequest } from '../api/request-utils';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { PushService } from './push.service';
import { PushSubscriptionDto, PushUnsubscribeDto } from './push.dto';

@Controller('api/push')
@UseGuards(TelegramAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /** null — VAPID на сервере не задан: сайт не предлагает включить. */
  @Get('config')
  config(): { publicKey: string | null } {
    return { publicKey: this.push.publicKey() };
  }

  @Post('subscription')
  @Throttle({ long: { limit: 20, ttl: 3_600_000 } })
  async subscribe(
    @Req() req: AuthRequest,
    @Body() body: PushSubscriptionDto,
  ): Promise<{ ok: true; delivered: boolean }> {
    const { delivered } = await this.push.subscribe(uid(req), {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });
    return { ok: true, delivered };
  }

  @Post('unsubscribe')
  @Throttle({ long: { limit: 30, ttl: 3_600_000 } })
  async unsubscribe(
    @Req() req: AuthRequest,
    @Body() body: PushUnsubscribeDto,
  ): Promise<{ ok: true }> {
    await this.push.unsubscribe(uid(req), body.endpoint, body.reason ?? 'user');
    return { ok: true };
  }
}
