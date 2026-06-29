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
import { PricingService } from './pricing.service';
import { DonationController } from '../donation/donation.controller';
import { DonationService } from '../donation/donation.service';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TelegramModule, AuthModule],
  controllers: [BookingController, BookingAdminController, PaymentController, DonationController],
  providers: [BookingService, BookingNotifyService, SlotService, AvailabilityService, CalDavService, MeetingService, RobokassaService, PricingService, DonationService],
  exports: [BookingService, SlotService],
})
export class BookingModule {}
