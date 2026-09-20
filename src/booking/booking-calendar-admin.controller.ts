import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminCalendarService } from './admin-calendar.service';
import { SlotOverrideService } from './slot-override.service';
import { assertAdminKey } from './admin-key.util';
import {
  AdminCalendarQueryDto,
  SlotOverridesDto,
} from './booking-calendar-admin.dto';

// Контроллер календаря слотов не грузит запросом с диапазоном в тысячелетия
// (тот же класс защиты, что MAX_SLOTS_RANGE_MS в booking.controller.ts).
const MAX_RANGE_DAYS = 35;

/**
 * Админ-эндпоинты календаря слотов (контракт «Календарь слотов в админке»).
 * За x-admin-key — ровно как booking-admin.controller.ts.
 */
@Controller('api/booking/admin/calendar')
export class BookingCalendarAdminController {
  private readonly adminKey: string;

  constructor(
    private readonly calendar: AdminCalendarService,
    private readonly overrides: SlotOverrideService,
    config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
  }

  /** GET /api/booking/admin/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get()
  async getCalendar(
    @Query() query: AdminCalendarQueryDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    assertValidRange(query.from, query.to);
    return this.calendar.getCalendar(query.from, query.to);
  }

  /** POST /api/booking/admin/calendar/overrides — ставит/снимает BLOCK/OPEN. */
  @Post('overrides')
  @HttpCode(HttpStatus.OK)
  async setOverrides(
    @Body() dto: SlotOverridesDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    const set = dto.set ?? [];
    const clear = dto.clear ?? [];
    if (!set.length && !clear.length) {
      throw new BadRequestException('Empty patch: set or clear required');
    }
    return this.overrides.apply({
      set: set.map((s) => ({
        startsAt: new Date(s.startsAt),
        durationMin: s.durationMin,
        kind: s.kind,
      })),
      clear: clear.map((c) => new Date(c)),
    });
  }
}

function assertValidRange(from: string, to: string): void {
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) {
    throw new BadRequestException('Invalid calendar date');
  }
  if (from > to) throw new BadRequestException('from must be <= to');
  const days =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(
      `Range too large (max ${MAX_RANGE_DAYS} days)`,
    );
  }
}

// "2026-02-30" парсится Date как валидная (переносится на март) — сверяем
// обратный ISO-вывод с исходной строкой, чтобы поймать несуществующий день.
function isValidCalendarDate(s: string): boolean {
  const ms = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  return new Date(ms).toISOString().slice(0, 10) === s;
}
