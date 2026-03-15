import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './telegram/telegram.module';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), TelegramModule, BotModule],
})
export class AppModule {}
