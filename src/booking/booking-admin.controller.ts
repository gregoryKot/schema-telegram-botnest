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
import type { CreateRuleDto } from './availability.service';
import { RobokassaService } from './robokassa.service';
import { MeetingService } from './meeting.service';
import { CalDavService } from './caldav.service';
import { PricingService } from './pricing.service';
import { assertAdminKey } from './admin-key.util';
import { SessionType } from '@prisma/client';

/**
 * Admin booking endpoints, guarded by ADMIN_BOOKING_KEY. The key is passed in
 * the `x-admin-key` request header (not query/body) so it never lands in
 * server access logs or browser history.
 */
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
    private readonly config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
  }

  /** GET /admin/prices — current session prices (for the admin form). */
  @Get('prices')
  async prices(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.pricing.getOptions();
  }

  /** PATCH /admin/price — set a session price (rubles). */
  @Patch('price')
  async setPrice(@Body() body: { type: SessionType; amount: number }, @Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    await this.pricing.setPrice(body.type, Number(body.amount));
    return { ok: true };
  }

  /** GET /admin/status — which integrations the running server actually sees (no secrets). */
  @Get('status')
  async status(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    const meeting = this.meeting.status;
    // How many busy intervals CalDAV returns for the next 14 days (diagnoses
    // over-blocking of slots). Fail-open inside getBusyTimes.
    let calendarBusyCount: number | null = null;
    if (this.calDav.enabled) {
      const now = new Date();
      const busy = await this.calDav.getBusyTimes(now, new Date(now.getTime() + 14 * 86_400_000));
      calendarBusyCount = busy.length;
    }
    return {
      siteUrl: this.config.get<string>('SITE_URL') ?? '(default kotlarewski.gr)',
      appUrl: this.config.get<string>('APP_URL') ?? '(default schemehappens.ru)',
      robokassa: this.robokassa.enabled,
      robokassaTest: this.config.get<string>('ROBOKASSA_IS_TEST') === 'true',
      zoom: meeting.zoom,
      zoomVars: meeting.zoomVars,
      meetingStaticUrl: meeting.staticUrl,
      appleCalendar: this.calDav.enabled,
      calendarBusyCount,
      emailFallback: !!this.config.get<string>('RESEND_API_KEY') && !!this.config.get<string>('ADMIN_EMAIL'),
    };
  }

  // ── Bookings ──────────────────────────────────────────────────────────────

  @Post('confirm/:id')
  @HttpCode(HttpStatus.OK)
  async confirm(@Param('id', ParseIntPipe) id: number, @Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.booking.confirm(id);
  }

  @Get('list')
  async list(@Headers('x-admin-key') key: string, @Query('filter') filter?: string) {
    assertAdminKey(key, this.adminKey);
    const allowed = ['upcoming', 'past', 'cancelled', 'all'] as const;
    const f = (allowed as readonly string[]).includes(filter ?? '') ? (filter as typeof allowed[number]) : 'upcoming';
    return this.booking.list(f);
  }

  // ── Availability rules ────────────────────────────────────────────────────

  @Get('rules')
  async listRules(@Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.availability.list();
  }

  @Post('rules')
  @HttpCode(HttpStatus.OK)
  async createRule(@Body() dto: CreateRuleDto, @Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.availability.create(dto);
  }

  @Patch('rules/:id')
  async toggleRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean },
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.availability.setActive(id, body.isActive);
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id', ParseIntPipe) id: number, @Headers('x-admin-key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.availability.remove(id);
  }
}
