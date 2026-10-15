import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PersistentThrottle } from './persistent-throttle.decorator';
import { BookingDto } from './dto/booking.dto';
import { IntroLeadService } from '../booking/intro-lead.service';

@Controller('api')
export class BookingController {
  constructor(private readonly introLead: IntroLeadService) {}

  // M4 (аудит 2026-10): заявка = запись в БД + DM админу + письмо, штатный лимит
  // в памяти не держит два инстанса — тот же Postgres-счётчик, что у /booking/book.
  @Throttle({ long: { limit: 6, ttl: 3_600_000 } })
  @PersistentThrottle()
  @Post('booking')
  @HttpCode(HttpStatus.OK)
  submitBooking(@Body() dto: BookingDto): Promise<{ ok: true }> {
    return this.introLead.submit(dto);
  }
}
