import {
  BadRequestException,
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
import { YsqService } from '../bot/ysq.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { computeYsqScores } from '../utils/ysq';
import { YsqProgressDto, YsqResultDto } from './dto/ratings.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Попытка теста глазами клиента: счёт схем вместо сырых ответов.
type Attempt = Awaited<ReturnType<YsqService['getYsqHistoryEntry']>>;
const toHistoryDto = (r: Attempt) => ({
  id: r.id,
  completedAt: r.completedAt.toISOString(),
  scores: computeYsqScores(r.answers),
});

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

  // Кнопка «Удалить результаты теста» в настройках: итог, история и прогресс.
  @Delete('ysq-data')
  async deleteAllYsqData(@Req() req: AuthRequest) {
    await this.ysqService.deleteAllYsqData(uid(req));
    return { ok: true };
  }

  @Get('ysq-history')
  async getYsqHistory(@Req() req: AuthRequest) {
    return (await this.ysqService.getYsqHistory(uid(req))).map(toHistoryDto);
  }

  // Одна попытка по id — её открывает «Мой путь» (в списке только 20).
  @Get('ysq-history/:id')
  async getYsqHistoryEntry(@Req() req: AuthRequest, @Param('id') raw: string) {
    const id = parseId(raw, { int32: true });
    return toHistoryDto(await this.ysqService.getYsqHistoryEntry(uid(req), id));
  }
}
