import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [BotService, PrismaService],
  exports: [BotService],
})
export class BotModule {}
