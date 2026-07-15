import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid } from './request-utils';
import { YsqService } from '../bot/ysq.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { computeYsqScores } from '../utils/ysq';
import { YsqProgressDto, YsqResultDto } from './dto/ratings.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Тест на схемы — прогресс прохождения, итоговый
// результат и история попыток.
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class YsqController {
  constructor(private readonly ysqService: YsqService) {}

  // ─── Progress ───────────────────────────────────────────────────────────────

  @Get('ysq-progress')
  async getYsqProgress(@Req() req: AuthRequest) {
    return this.ysqService.getYsqProgress(uid(req));
  }

  @Post('ysq-progress')
  async saveYsqProgress(@Req() req: AuthRequest, @Body() body: YsqProgressDto) {
    if (!Array.isArray(body.answers) || body.answers.length !== 116)
      throw new BadRequestException('Invalid answers');
    if (!body.answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 6))
      throw new BadRequestException('Invalid answer values');
    if (!Number.isInteger(body.page) || body.page < 0)
      throw new BadRequestException('Invalid page');
    await this.ysqService.saveYsqProgress(uid(req), body.answers, body.page);
    return { ok: true };
  }

  @Delete('ysq-progress')
  async deleteYsqProgress(@Req() req: AuthRequest) {
    await this.ysqService.deleteYsqProgress(uid(req));
    return { ok: true };
  }

  // ─── Result ─────────────────────────────────────────────────────────────────

  @Get('ysq-result')
  async getYsqResult(@Req() req: AuthRequest) {
    return this.ysqService.getYsqResult(uid(req));
  }

  @Post('ysq-result')
  async saveYsqResult(@Req() req: AuthRequest, @Body() body: YsqResultDto) {
    if (!Array.isArray(body.answers) || body.answers.length !== 116)
      throw new BadRequestException('Invalid answers');
    if (!body.answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 6))
      throw new BadRequestException('Invalid answer values');
    await this.ysqService.saveYsqResult(uid(req), body.answers);
    return { ok: true };
  }

  @Delete('ysq-result')
  async deleteYsqResult(@Req() req: AuthRequest) {
    await this.ysqService.deleteYsqResult(uid(req));
    return { ok: true };
  }

  @Get('ysq-history')
  async getYsqHistory(@Req() req: AuthRequest) {
    const raw = await this.ysqService.getYsqHistory(uid(req));
    return raw.map((r) => ({
      id: r.id,
      completedAt: r.completedAt.toISOString(),
      scores: computeYsqScores(r.answers),
    }));
  }
}
