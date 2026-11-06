import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottle } from '../api/persistent-throttle.decorator';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';
import { type AuthRequest, uid } from '../api/request-utils';
import { ClientBookingService } from './client-booking.service';
import { ClientBookDto } from './client-book.dto';

// Запись клиента на сессию из приложения (#546). Свой префикс, а не
// /api/booking/*: тот целиком открыт на визитке kotlarewski.gr
// (PRACTICE_API_PREFIXES), а эта ручка — продуктовый API под входом и живёт
// только на schemehappens.ru (правило №19). Слоты — общий GET /api/booking/slots.
@Controller('api/client-booking')
@UseGuards(TelegramAuthGuard)
export class ClientBookingController {
  constructor(private readonly clientBooking: ClientBookingService) {}

  /** GET /api/client-booking — можно ли записаться и свои ближайшие брони. */
  @Get()
  overview(@Req() req: AuthRequest) {
    return this.clientBooking.overview(uid(req));
  }

  /** POST /api/client-booking/book — бронь слота: денежная ручка, счётчик в Postgres (№5). */
  @Post('book')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 6, ttl: 3_600_000 } })
  @PersistentThrottle()
  book(@Req() req: AuthRequest, @Body() dto: ClientBookDto) {
    return this.clientBooking.book(uid(req), {
      startsAt: new Date(dto.startsAt),
      durationMin: dto.durationMin ?? 50,
      clientTimeZone: dto.clientTimeZone?.trim() || undefined,
    });
  }
}
