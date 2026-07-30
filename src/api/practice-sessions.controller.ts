import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { uid } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { PracticeSessionsService } from '../bot/practice-sessions.service';
import { RecordPracticeSessionDto } from './dto/practice-session.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Быстрые практики «Здесь и сейчас» (дыхание/заземление/«Стоп») — фиксируем
// каждое прохождение, чтобы «Мой путь» и /stats видели след, а не пустоту.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class PracticeSessionsController {
  constructor(private readonly practiceSessions: PracticeSessionsService) {}

  // Идентичность верифицирована гардом (правило №5) — троттлинг per-user,
  // с запасом под серию быстрых нажатий, но не даёт заспамить таблицу.
  @Post('practice-session')
  @Throttle({ long: { limit: 60, ttl: 60_000 } })
  async record(
    @Req() req: AuthRequest,
    @Body() body: RecordPracticeSessionDto,
  ): Promise<{ ok: true; count: number }> {
    const { count } = await this.practiceSessions.record(uid(req), body.tool);
    return { ok: true, count };
  }

  @Get('practice-sessions')
  getCounts(@Req() req: AuthRequest) {
    return this.practiceSessions.counts(uid(req));
  }
}
