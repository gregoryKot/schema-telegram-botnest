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

// D1 (аудит 2026-08): жёсткий потолок окна /slots — квартал с запасом. Больше
// календарю бронирования не нужно, а без потолка перебор по суткам вешал API.
const MAX_SLOTS_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

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
  @Throttle({ long: { limit: 300, ttl: 3_600_000 } })
  async getSlots(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = parseSlotDate(from) ?? new Date();
    const toDate = parseSlotDate(to) ?? addDays(fromDate, 14);
    // D1 (аудит 2026-08): без ограничения диапазона getSlots бежал по СУТКАМ от
    // from до to (millions на `?from=1000-01-01&to=9999-12-31`), блокируя
    // event-loop → DoS всего API на неавторизованном GET. Ограничиваем окно:
    // календарь бронирования показывает недели, не тысячелетия.
    if (toDate.getTime() - fromDate.getTime() > MAX_SLOTS_RANGE_MS)
      throw new BadRequestException('Диапазон слотов не больше 92 дней');
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
      source: dto.source?.trim() || undefined,
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

// L11 аудита 2026-08: сырой query-параметр уходил в new Date() и на кривой
// строке давал Invalid Date → Prisma 500 на неавторизованном GET. Пускаем
// только YYYY-MM-DD (формат из доккоммента эндпоинта); пусто → null (дефолт
// вызывающего), мусор → 400 (контролируемый ответ вместо 500).
function parseSlotDate(v: string | undefined): Date | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new BadRequestException('Некорректная дата, ожидается YYYY-MM-DD');
  const d = new Date(v);
  if (Number.isNaN(d.getTime()))
    throw new BadRequestException('Некорректная дата');
  return d;
}
