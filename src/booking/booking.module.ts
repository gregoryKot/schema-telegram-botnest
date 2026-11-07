import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { SlotService } from './slot.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BOOKING_CONTROLLERS, BOOKING_PROVIDERS } from './booking.registry';

@Module({
  imports: [TelegramModule, AuthModule, AnalyticsModule],
  controllers: BOOKING_CONTROLLERS,
  providers: BOOKING_PROVIDERS,
  exports: [BookingService, SlotService, SubscriptionService],
})
export class BookingModule {}
