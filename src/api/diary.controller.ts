import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid, parseId } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { DiaryService } from '../bot/diary.service';
import { TherapyTasksService } from '../therapy/therapy-tasks.service';
import {
  SchemaDiaryDto,
  ModeDiaryDto,
  GratitudeDiaryDto,
} from './dto/diary-entries.dto';

interface AuthRequest extends Request {
  telegramUserId: number;
  webUser: { userId: bigint };
}

// uid()/parseId() — единый источник в request-utils (аудит 2026-07, 2в).
// Заодно ужесточение: parseInt принимал «5abc» как 5, теперь это 400.

@Controller('api/diary')
@UseGuards(TelegramAuthGuard)
export class DiaryController {
  private readonly logger = new Logger(DiaryController.name);

  constructor(
    private readonly diaryService: DiaryService,
    private readonly tasksService: TherapyTasksService,
  ) {}

  // ─── Schema Diary ─────────────────────────────────────────────────────────

  @Get('schema')
  getSchemaDiary(@Req() req: AuthRequest) {
    return this.diaryService.getSchemaDiaryEntries(uid(req));
  }

  @Post('schema')
  async createSchemaDiary(
    @Req() req: AuthRequest,
    @Body() body: SchemaDiaryDto,
  ) {
    if (!body.trigger?.trim())
      throw new BadRequestException('trigger required');
    const LIMIT = 2000;
    const trimmed = {
      ...body,
      trigger: body.trigger.slice(0, LIMIT),
      thoughts: body.thoughts?.slice(0, LIMIT),
      bodyFeelings: body.bodyFeelings?.slice(0, LIMIT),
      actualBehavior: body.actualBehavior?.slice(0, LIMIT),
      schemaOrigin: body.schemaOrigin?.slice(0, LIMIT),
      healthyView: body.healthyView?.slice(0, LIMIT),
      realProblems: body.realProblems?.slice(0, LIMIT),
      excessiveReactions: body.excessiveReactions?.slice(0, LIMIT),
      healthyBehavior: body.healthyBehavior?.slice(0, LIMIT),
    };
    const entry = await this.diaryService.createSchemaDiaryEntry(
      uid(req),
      trimmed,
    );
    this.tasksService
      .checkStreakTasks(uid(req))
      .catch((err) => this.logger.error('checkStreakTasks failed', err));
    return entry;
  }

  @Delete('schema/:id')
  async deleteSchemaDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteSchemaDiaryEntry(uid(req), parseId(id));
    return { ok: true };
  }

  // ─── Mode Diary ───────────────────────────────────────────────────────────

  @Get('mode')
  getModeDiary(@Req() req: AuthRequest) {
    return this.diaryService.getModeDiaryEntries(uid(req));
  }

  @Post('mode')
  async createModeDiary(@Req() req: AuthRequest, @Body() body: ModeDiaryDto) {
    if (!body.modeId?.trim()) throw new BadRequestException('modeId required');
    if (!body.situation?.trim())
      throw new BadRequestException('situation required');
    const LIMIT = 2000;
    const trimmedMode = {
      ...body,
      situation: body.situation.slice(0, LIMIT),
      thoughts: body.thoughts?.slice(0, LIMIT),
      feelings: body.feelings?.slice(0, LIMIT),
      bodyFeelings: body.bodyFeelings?.slice(0, LIMIT),
      actions: body.actions?.slice(0, LIMIT),
      actualNeed: body.actualNeed?.slice(0, LIMIT),
      childhoodMemories: body.childhoodMemories?.slice(0, LIMIT),
    };
    const entry = await this.diaryService.createModeDiaryEntry(
      uid(req),
      trimmedMode,
    );
    this.tasksService
      .checkStreakTasks(uid(req))
      .catch((err) => this.logger.error('checkStreakTasks failed', err));
    return entry;
  }

  @Delete('mode/:id')
  async deleteModeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteModeDiaryEntry(uid(req), parseId(id));
    return { ok: true };
  }

  // ─── Gratitude Diary ──────────────────────────────────────────────────────

  @Get('gratitude')
  getGratitudeDiary(@Req() req: AuthRequest) {
    return this.diaryService.getGratitudeDiaryEntries(uid(req));
  }

  @Post('gratitude')
  async createGratitudeDiary(
    @Req() req: AuthRequest,
    @Body() body: GratitudeDiaryDto,
  ) {
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
      throw new BadRequestException('Invalid date');
    const items = body.items.map((s: string) => String(s).slice(0, 500));
    const entry = await this.diaryService.upsertGratitudeDiaryEntry(
      uid(req),
      body.date,
      items,
    );
    this.tasksService
      .checkStreakTasks(uid(req))
      .catch((err) => this.logger.error('checkStreakTasks failed', err));
    return entry;
  }

  @Delete('gratitude/:id')
  async deleteGratitudeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteGratitudeDiaryEntry(uid(req), parseId(id));
    return { ok: true };
  }
}
