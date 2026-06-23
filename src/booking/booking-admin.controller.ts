import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingService } from './booking.service';
import { AvailabilityService, CreateRuleDto } from './availability.service';
import { assertAdminKey } from './admin-key.util';

/**
 * Admin booking endpoints, guarded by ADMIN_BOOKING_KEY. The key is passed as a
 * `key` query param (GET/DELETE) or `adminKey` body field (POST/PATCH).
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
  async confirm(@Param('id', ParseIntPipe) id: number, @Body() body: { adminKey: string }) {
    assertAdminKey(body.adminKey, this.adminKey);
    return this.booking.confirm(id);
  }

  @Get('list')
  async list(@Query('key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.booking.listUpcoming();
  }

  // ── Availability rules ────────────────────────────────────────────────────

  @Get('rules')
  async listRules(@Query('key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.availability.list();
  }

  @Post('rules')
  @HttpCode(HttpStatus.OK)
  async createRule(@Body() body: CreateRuleDto & { adminKey: string }) {
    assertAdminKey(body.adminKey, this.adminKey);
    const { adminKey: _key, ...dto } = body;
    return this.availability.create(dto);
  }

  @Patch('rules/:id')
  async toggleRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean; adminKey: string },
  ) {
    assertAdminKey(body.adminKey, this.adminKey);
    return this.availability.setActive(id, body.isActive);
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id', ParseIntPipe) id: number, @Query('key') key: string) {
    assertAdminKey(key, this.adminKey);
    return this.availability.remove(id);
  }
}
