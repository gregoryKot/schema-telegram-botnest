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
import { assertAdminKey } from './admin-key.util';

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
    config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
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
