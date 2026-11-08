import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { PracticeIcsLinkDto } from './dto/practice-ics.dto';
import {
  openPracticeIcs,
  practiceIcsText,
  sealPracticeIcs,
} from './practice-ics';

// .ics шага плана по https (аудит 2026-11, E6): вошедший человек получает
// ссылку (POST, под гвардом), файл по ней отдаёт GET без входа — его
// открывает внешний браузер, у которого нашей сессии нет. Что в ссылке и
// почему её нельзя подделать — practice-ics.ts. Токен идёт после сегмента
// `ics` — safeRequestPath маскирует его в алертах (prisma/safe-request-path.ts).
@Controller('api/plan/ics')
export class PracticeIcsController {
  @Post()
  @UseGuards(TelegramAuthGuard)
  @HttpCode(HttpStatus.OK)
  createLink(@Body() body: PracticeIcsLinkDto) {
    return { path: `/api/plan/ics/${sealPracticeIcs(body)}` };
  }

  @Get(':token')
  getFile(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const event = openPracticeIcs(token);
    if (!event)
      throw new NotFoundException('Ссылка на файл календаря устарела');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="practice.ics"');
    return practiceIcsText(event);
  }
}
