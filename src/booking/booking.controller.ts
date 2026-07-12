import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingService, CreateBookingDto } from './booking.service';
import { SlotService } from './slot.service';
import { PricingService } from './pricing.service';
import { SessionType } from '@prisma/client';
import { BookDto } from './book.dto';

/** Public booking endpoints: browse slots, book one, self-cancel. */
@Controller('api/booking')
export class BookingController {
  constructor(
    private readonly slots: SlotService,
    private readonly booking: BookingService,
    private readonly pricing: PricingService,
  ) {}

  /** GET /api/booking/options — session types, durations and prices for the UI. */
  @Get('options')
  getOptions() {
    return this.pricing.getOptions();
  }

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

  /**
   * POST /api/booking/book — book a slot (free intro confirms immediately).
   * Anti-spam: per-IP rate limit (max 6/hour via the 'long' bucket) + honeypot.
   */
  @Post('book')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 6, ttl: 3_600_000 } })
  async bookSlot(@Body() dto: BookDto) {
    if (dto.website) throw new BadRequestException('rejected'); // honeypot tripped
    const payload: CreateBookingDto = {
      startsAt: new Date(dto.startsAt),
      durationMin: dto.durationMin ?? 50,
      type: dto.type ?? SessionType.INTRO_15,
      clientName: dto.clientName?.trim(),
      clientContact: dto.clientContact?.trim(),
      message: dto.message?.trim(),
      clientTelegramId: dto.clientTelegramId
        ? BigInt(dto.clientTelegramId)
        : undefined,
      returning: dto.returning ?? false,
      acceptedOffer: dto.acceptedOffer ?? false,
    };
    return this.booking.book(payload);
  }

  /** GET /api/booking/by-token/:token — public booking view (no PII) for the post-payment page. */
  @Get('by-token/:token')
  @Throttle({ long: { limit: 60, ttl: 3_600_000 } })
  async getByToken(@Param('token') token: string) {
    return this.booking.getPublicByToken(token);
  }

  /** POST /api/booking/cancel/:token — client self-cancel */
  @Post('cancel/:token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 30, ttl: 3_600_000 } })
  async cancelByToken(@Param('token') token: string) {
    return this.booking.cancel(token);
  }
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
