import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingAdminController } from './booking-admin.controller';
import { PaymentController } from './payment.controller';
import { BookingService } from './booking.service';
import { BookingNotifyService } from './booking-notify.service';
import { SlotService } from './slot.service';
import { AvailabilityService } from './availability.service';
import { CalDavService } from './caldav.service';
import { MeetingService } from './meeting.service';
import { RobokassaService } from './robokassa.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [BookingController, BookingAdminController, PaymentController],
  providers: [BookingService, BookingNotifyService, SlotService, AvailabilityService, CalDavService, MeetingService, RobokassaService],
  exports: [BookingService, SlotService],
})
export class BookingModule {}
