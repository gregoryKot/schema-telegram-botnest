import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [BotModule],
  controllers: [ApiController],
  providers: [TelegramAuthGuard],
})
export class ApiModule {}
