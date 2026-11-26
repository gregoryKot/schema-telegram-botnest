import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthModule } from '../auth/auth.module';
import { BookingController } from '../api/booking.controller';
import { IntroLeadService } from './intro-lead.service';
import { IntroLeadRedeliveryService } from './intro-lead-redelivery.service';
import { IntroLeadRetentionService } from './intro-lead-retention.service';

// Заявка с простой формы знакомства (POST /api/booking): контроллер, запись в
// БД с доставкой админу и ночное обезличивание. Отдельный модуль, чтобы не
// раздувать ApiModule и BookingModule (правило №10).
@Module({
  imports: [TelegramModule, AuthModule],
  controllers: [BookingController],
  providers: [
    IntroLeadService,
    IntroLeadRedeliveryService,
    IntroLeadRetentionService,
  ],
})
export class IntroLeadModule {}
