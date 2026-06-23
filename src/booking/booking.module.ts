import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingAdminController } from './booking-admin.controller';
import { BookingService } from './booking.service';
import { BookingNotifyService } from './booking-notify.service';
import { SlotService } from './slot.service';
import { AvailabilityService } from './availability.service';
import { CalDavService } from './caldav.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [BookingController, BookingAdminController],
  providers: [BookingService, BookingNotifyService, SlotService, AvailabilityService, CalDavService],
  exports: [BookingService, SlotService],
})
export class BookingModule {}
