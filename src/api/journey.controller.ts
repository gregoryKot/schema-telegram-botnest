import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { uid } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { JourneyService } from '../bot/journey.service';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// «Мой путь» — сводный архив всей активности (счётчики + лента без
// расшифровки свободного текста). Только чтение, тела запроса нет.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  @Get('journey')
  getJourney(@Req() req: AuthRequest) {
    return this.journeyService.getJourney(uid(req));
  }
}
