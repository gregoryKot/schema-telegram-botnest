import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { SlotService } from './slot.service';
import { AvailabilityService } from './availability.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [BookingController],
  providers: [BookingService, SlotService, AvailabilityService],
  exports: [BookingService, SlotService],
})
export class BookingModule {}
