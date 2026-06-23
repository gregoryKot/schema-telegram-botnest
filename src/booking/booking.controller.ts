import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingService, CreateBookingDto } from './booking.service';
import { SlotService } from './slot.service';
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

/** Public booking endpoints: browse slots, hold one, self-cancel. */
@Controller('api/booking')
export class BookingController {
  constructor(
    private readonly slots: SlotService,
    private readonly booking: BookingService,
  ) {}

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
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
