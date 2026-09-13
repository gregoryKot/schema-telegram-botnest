import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottle } from '../api/persistent-throttle.decorator';
import { SubscriptionService } from './subscription.service';
import { SubscribeDto } from './subscription.dto';

@Controller('api/subscription')
export class SubscriptionController {
  constructor(private readonly subs: SubscriptionService) {}

  /** GET /api/subscription/options — whether enabled + periods and current prices. */
  @Get('options')
  async options() {
    const options = await this.subs.getOptions();
    return { enabled: this.subs.isEnabled(), options };
  }

  /** POST /api/subscription — start a subscription, returns a payment URL. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 6, ttl: 3_600_000 } })
  @PersistentThrottle()
  async subscribe(@Body() dto: SubscribeDto) {
    if (dto.website) throw new BadRequestException('rejected'); // honeypot
    return this.subs.subscribe({
      period: dto.period === 'year' ? 'year' : 'month',
      email: dto.email?.trim() || undefined,
      acceptedOffer: dto.acceptedOffer,
    });
  }

  /** GET /api/subscription/by-token/:token — public status (no PII). */
  @Get('by-token/:token')
  @Throttle({ long: { limit: 60, ttl: 3_600_000 } })
  getByToken(@Param('token') token: string) {
    return this.subs.getPublicByToken(token);
  }

  /** POST /api/subscription/cancel/:token — client self-cancel. */
  @Post('cancel/:token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 30, ttl: 3_600_000 } })
  @PersistentThrottle()
  cancel(@Param('token') token: string) {
    return this.subs.cancel(token);
  }
}
