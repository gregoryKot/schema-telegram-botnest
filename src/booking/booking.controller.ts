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
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingService, CreateBookingDto } from './booking.service';
import { SlotService } from './slot.service';
import { AvailabilityService, CreateRuleDto } from './availability.service';
import { SessionType } from '@prisma/client';

interface HoldDto {
  startsAt: string;      // ISO string
  durationMin?: number;
  type?: SessionType;
  clientName: string;
  clientContact: string;
  message?: string;
  clientTelegramId?: string;
}

interface AdminConfirmDto {
  adminKey: string;
}

@Controller('api/booking')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);
  private readonly adminKey: string;

  constructor(
    private readonly slots: SlotService,
    private readonly booking: BookingService,
    private readonly availability: AvailabilityService,
    config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
  }

  // ── Public endpoints ───────────────────────────────────────────────────────

  /** GET /api/booking/slots?from=2026-06-23&to=2026-06-30 */
  @Get('slots')
  async getSlots(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : addDays(fromDate, 14);
    const list = await this.slots.getSlots(fromDate, toDate);
    return list.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      durationMin: s.durationMin,
    }));
  }

  /** POST /api/booking/hold — reserve a slot (15 min window) */
  @Post('hold')
  @HttpCode(HttpStatus.OK)
  async holdSlot(@Body() dto: HoldDto) {
    const payload: CreateBookingDto = {
      startsAt: new Date(dto.startsAt),
      durationMin: dto.durationMin ?? 50,
      type: dto.type ?? SessionType.SESSION_50,
      clientName: dto.clientName?.trim(),
      clientContact: dto.clientContact?.trim(),
      message: dto.message?.trim(),
      clientTelegramId: dto.clientTelegramId ? BigInt(dto.clientTelegramId) : undefined,
    };
    return this.booking.hold(payload);
  }

  /** POST /api/booking/cancel/:token — client self-cancel */
  @Post('cancel/:token')
  @HttpCode(HttpStatus.OK)
  async cancelByToken(@Param('token') token: string) {
    return this.booking.cancel(token);
  }

  // ── Admin endpoints (protected by ADMIN_BOOKING_KEY header value) ──────────

  /** POST /api/booking/admin/confirm/:id */
  @Post('admin/confirm/:id')
  @HttpCode(HttpStatus.OK)
  async adminConfirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminConfirmDto,
  ) {
    this.assertAdmin(dto.adminKey);
    return this.booking.confirm(id);
  }

  /** GET /api/booking/admin/list */
  @Get('admin/list')
  async adminList(@Query('key') key: string) {
    this.assertAdmin(key);
    return this.booking.listUpcoming();
  }

  // ── Availability rules (admin) ─────────────────────────────────────────────

  @Get('admin/rules')
  async listRules(@Query('key') key: string) {
    this.assertAdmin(key);
    return this.availability.list();
  }

  @Post('admin/rules')
  @HttpCode(HttpStatus.OK)
  async createRule(@Body() body: CreateRuleDto & { adminKey: string }) {
    this.assertAdmin(body.adminKey);
    const { adminKey: _key, ...dto } = body;
    return this.availability.create(dto);
  }

  @Patch('admin/rules/:id')
  async toggleRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean; adminKey: string },
  ) {
    this.assertAdmin(body.adminKey);
    return this.availability.setActive(id, body.isActive);
  }

  @Delete('admin/rules/:id')
  async deleteRule(
    @Param('id', ParseIntPipe) id: number,
    @Query('key') key: string,
  ) {
    this.assertAdmin(key);
    return this.availability.remove(id);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private assertAdmin(key: string) {
    if (!this.adminKey || key !== this.adminKey) {
      throw new ForbiddenException('Invalid admin key');
    }
  }
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
