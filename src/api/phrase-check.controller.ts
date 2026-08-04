import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid, parseId } from './request-utils';
import { PhraseCheckService } from '../bot/phrase-check.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { PhraseCheckDto } from './dto/phrase-check.dto';
import type { PhraseMarkId } from '../bot/phrase-check.constants';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Упражнение «Разобрать фразу»: собственный контроллер, а не ветка в
// exercises.controller.ts (правило №10 — файл-долг не пухнет дальше).
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class PhraseCheckController {
  constructor(private readonly phraseChecks: PhraseCheckService) {}

  @Get('phrase-checks')
  getPhraseChecks(@Req() req: AuthRequest) {
    return this.phraseChecks.getPhraseChecks(uid(req));
  }

  @Post('phrase-checks')
  createPhraseCheck(@Req() req: AuthRequest, @Body() body: PhraseCheckDto) {
    return this.phraseChecks.createPhraseCheck(uid(req), {
      phrase: body.phrase.trim(),
      marks: body.marks as PhraseMarkId[],
      rewrite: body.rewrite?.trim() || undefined,
    });
  }

  @Delete('phrase-checks/:id')
  deletePhraseCheck(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.phraseChecks.deletePhraseCheck(uid(req), parseId(id));
  }
}
