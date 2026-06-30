import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscriptionService } from './subscription.service';

interface SubscribeDto {
  period?: 'month' | 'year';
  email?: string;
  /** Honeypot — must stay empty. */
  website?: string;
}

/** Public subscription endpoints: options, subscribe, view, cancel. */
@Controller('api/subscription')
export class SubscriptionController {
  constructor(private readonly subs: SubscriptionService) {}

  /** GET /api/subscription/options — periods and current prices. */
  @Get('options')
  options() {
    return this.subs.getOptions();
  }

  /** POST /api/subscription — start a subscription, returns a payment URL. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 6, ttl: 3_600_000 } })
  async subscribe(@Body() dto: SubscribeDto) {
    if (dto.website) throw new BadRequestException('rejected'); // honeypot
    return this.subs.subscribe({ period: dto.period === 'year' ? 'year' : 'month', email: dto.email?.trim() || undefined });
  }

  /** GET /api/subscription/by-token/:token — public status (no PII). */
  @Get('by-token/:token')
  getByToken(@Param('token') token: string) {
    return this.subs.getPublicByToken(token);
  }

  /** POST /api/subscription/cancel/:token — client self-cancel. */
  @Post('cancel/:token')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('token') token: string) {
    return this.subs.cancel(token);
  }
}
