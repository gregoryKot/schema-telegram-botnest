import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingService } from './booking.service';
import { AvailabilityService } from './availability.service';
import { RobokassaService } from './robokassa.service';
import { MeetingService } from './meeting.service';
import { CalDavService } from './caldav.service';
import { buildCalendarStatus } from './booking-admin.calendar';
import { buildAdminStatus } from './booking-admin.status';
import { PricingService } from './pricing.service';
import { SetPriceDto, SetSubPriceDto } from './booking-price.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { AdminThrottle, assertAdminKey } from './admin-key.util';
import { CreateRuleDto, ToggleRuleDto } from './booking-admin.dto';

/**
 * Admin booking endpoints, guarded by ADMIN_BOOKING_KEY. The key is passed in
 * the `x-admin-key` request header (not query/body) so it never lands in
 * server access logs or browser history.
 */
@AdminThrottle()
@Controller('api/booking/admin')
export class BookingAdminController {
  private readonly adminKey: string;

  constructor(
    private readonly booking: BookingService,
    private readonly availability: AvailabilityService,
    private readonly robokassa: RobokassaService,
    private readonly meeting: MeetingService,
    private readonly calDav: CalDavService,
    private readonly pricing: PricingService,
    private readonly subs: SubscriptionService,
    private readonly config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
  }

  /** GET /admin/prices — session prices in every currency (for the admin form). */
  @Get('prices')
  async prices(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.pricing.getOptions();
  }

  /** PATCH /admin/price — set a session price (rubles unless `currency` is given). */
  @Patch('price')
  async setPrice(
    @Body() body: SetPriceDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    await this.pricing.setPrice(body.type, Number(body.amount), body.currency);
    return { ok: true };
  }

  /** GET /admin/status — which integrations the running server actually sees (no secrets). */
  @Get('status')
  async status(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    // Fail-open inside buildCalendarStatus/getBusyTimes.
    const cal = await buildCalendarStatus(this.calDav);
    return buildAdminStatus(this.config, this.meeting, this.robokassa, cal);
  }

  // ── Bookings ──────────────────────────────────────────────────────────────

  @Post('confirm/:id')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.booking.confirm(id);
  }

  /** POST /admin/cancel/:id — отмена владельцем в любой срок (публичная
   *  cancel/:token держит cutoff 24 ч). Переход тот же, токен с сервера не уходит. */
  @Post('cancel/:id')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    const { cancelToken } = await this.booking.getById(id);
    return this.booking.cancel(cancelToken, false);
  }

  @Get('list')
  async list(
    @Headers('x-admin-key') key: string,
    @Query('filter') filter?: string,
  ) {
    assertAdminKey(key, this.adminKey);
    const allowed = ['upcoming', 'past', 'cancelled', 'all'] as const;
    const f = (allowed as readonly string[]).includes(filter ?? '')
      ? (filter as (typeof allowed)[number])
      : 'upcoming';
    return this.booking.list(f);
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /** GET /admin/sub-prices — current subscription prices (month/year). */
  @Get('sub-prices')
  async subPrices(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.subs.getOptions();
  }

  /** PATCH /admin/sub-price — set a subscription price (rubles). */
  @Patch('sub-price')
  async setSubPrice(
    @Body() body: SetSubPriceDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    await this.subs.setPrice(
      body.period === 'year' ? 'year' : 'month',
      Number(body.amount),
    );
    return { ok: true };
  }

  // ── Availability rules ────────────────────────────────────────────────────

  @Get('rules')
  async listRules(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.availability.list();
  }

  @Post('rules')
  @HttpCode(HttpStatus.OK)
  async createRule(
    @Body() dto: CreateRuleDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.availability.create(dto);
  }

  @Patch('rules/:id')
  async toggleRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ToggleRuleDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.availability.setActive(id, body.isActive);
  }

  @Delete('rules/:id')
  async deleteRule(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.availability.remove(id);
  }
}
