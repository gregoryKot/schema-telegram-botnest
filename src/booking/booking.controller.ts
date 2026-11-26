import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PersistentThrottle } from '../api/persistent-throttle.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { BookingService, CreateBookingDto } from './booking.service';
import { SlotService } from './slot.service';
import { PricingService } from './pricing.service';
import { buildBookingIcsText } from './booking-ics';
import { SessionType } from '@prisma/client';
import { BookDto } from './book.dto';
import { resolveSlotRange } from './slot-range';

/** Public booking endpoints: browse slots, book one, self-cancel. */
@Controller('api/booking')
export class BookingController {
  private readonly siteUrl: string;

  constructor(
    private readonly slots: SlotService,
    private readonly booking: BookingService,
    private readonly pricing: PricingService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Тот же env и тот же дефолт, что у booking-notify.service.ts.
    // /booking/manage — страница визитки (PRACTICE_PAGES), поэтому
    // дефолт-хост — kotlarewski.gr, а не канонический хост приложения.
    this.siteUrl = (
      config.get<string>('SITE_URL') ?? 'https://kotlarewski.gr'
    ).replace(/\/$/, '');
  }

  /** GET /api/booking/options — session types, durations and prices for the UI. */
  @Get('options')
  getOptions() {
    return this.pricing.getOptions();
  }

  /** GET /api/booking/slots?from=2026-06-23&to=2026-06-30 */
  @Get('slots')
  @Throttle({ long: { limit: 300, ttl: 3_600_000 } })
  async getSlots(@Query('from') from: string, @Query('to') to: string) {
    // D1 (аудит 2026-08): без ограничения диапазона getSlots бежал по СУТКАМ от
    // from до to (millions на `?from=1000-01-01&to=9999-12-31`) → DoS всего API.
    // S17 (аудит 2026-11): прошлое, конец раньше начала и дни за горизонтом
    // записи — 400; остальное нарезается из одного окна календаря.
    const range = resolveSlotRange(from, to);
    const list = await this.slots.getSlots(range.from, range.to);
    return list.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      durationMin: s.durationMin,
    }));
  }

  /** POST /api/booking/book — book a slot; rate-limited + honeypot anti-spam. */
  @Post('book')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 6, ttl: 3_600_000 } })
  @PersistentThrottle()
  async bookSlot(@Body() dto: BookDto) {
    if (dto.website) throw new BadRequestException('rejected'); // honeypot tripped
    const payload: CreateBookingDto = {
      startsAt: new Date(dto.startsAt),
      durationMin: dto.durationMin ?? 50,
      type: dto.type ?? SessionType.INTRO_15,
      clientName: dto.clientName?.trim(),
      clientContact: dto.clientContact?.trim(),
      clientChannel: dto.clientChannel,
      message: dto.message?.trim(),
      returning: dto.returning ?? false,
      acceptedOffer: dto.acceptedOffer ?? false,
      source: dto.source?.trim() || undefined,
      clientTimeZone: dto.clientTimeZone?.trim() || undefined,
      currency: dto.currency,
    };
    return this.booking.book(payload);
  }

  /** GET /api/booking/by-token/:token — public booking view (no PII) for the post-payment page. */
  @Get('by-token/:token')
  @Throttle({ long: { limit: 60, ttl: 3_600_000 } })
  async getByToken(@Param('token') token: string) {
    return this.booking.getPublicByToken(token);
  }

  /** GET /api/booking/ics/:token — .ics для клиента (Apple/Outlook), без PII. */
  @Get('ics/:token')
  @Throttle({ long: { limit: 60, ttl: 3_600_000 } })
  async getIcs(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ics = await buildBookingIcsText(this.prisma, token, this.siteUrl);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="zapis.ics"');
    return ics;
  }

  /** POST /api/booking/cancel/:token — client self-cancel */
  @Post('cancel/:token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 30, ttl: 3_600_000 } })
  @PersistentThrottle()
  async cancelByToken(@Param('token') token: string) {
    return this.booking.cancel(token);
  }
}
