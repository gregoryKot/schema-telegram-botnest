import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid, parseId } from './request-utils';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { DiaryService } from '../bot/diary.service';
import { TherapyTasksService } from '../therapy/therapy-tasks.service';
import { SchemaDiaryDto, ModeDiaryDto } from './dto/diary-entries.dto';
import { GratitudeDiaryDto } from './dto/gratitude-diary.dto';
import { DIARY_KINDS, type DiaryKind } from '../bot/diary-page';

const id32 = (raw: string) => parseId(raw, { int32: true });

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

  // «Записи» → «Показать ещё» (R6): страница старше записи `before`.
  @Get('page/:kind')
  getDiaryPage(
    @Req() req: AuthRequest,
    @Param('kind') kind: string,
    @Query('before') before?: string,
  ) {
    if (!DIARY_KINDS.includes(kind as DiaryKind))
      throw new BadRequestException('Invalid kind');
    const cursor = before === undefined ? undefined : id32(before);
    return this.diaryService.getDiaryPage(uid(req), kind as DiaryKind, cursor);
  }

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
    const entry = await this.diaryService.createSchemaDiaryEntry(
      uid(req),
      body,
    );
    this.tasksService
      .checkStreakTasks(uid(req))
      .catch((err) => this.logger.error('checkStreakTasks failed', err));
    return entry;
  }

  // Одна запись по id — её открывает «Мой путь».
  @Get('schema/:id')
  getSchemaDiaryEntry(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.diaryService.getSchemaDiaryEntry(uid(req), id32(id));
  }

  @Delete('schema/:id')
  async deleteSchemaDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteSchemaDiaryEntry(uid(req), id32(id));
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
    const entry = await this.diaryService.createModeDiaryEntry(uid(req), body);
    this.tasksService
      .checkStreakTasks(uid(req))
      .catch((err) => this.logger.error('checkStreakTasks failed', err));
    return entry;
  }

  @Get('mode/:id')
  getModeDiaryEntry(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.diaryService.getModeDiaryEntry(uid(req), id32(id));
  }

  @Delete('mode/:id')
  async deleteModeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteModeDiaryEntry(uid(req), id32(id));
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
    const entry = await this.diaryService.upsertGratitudeDiaryEntry(
      uid(req),
      body.date,
      body.items,
      body.base,
    );
    this.tasksService
      .checkStreakTasks(uid(req))
      .catch((err) => this.logger.error('checkStreakTasks failed', err));
    return entry;
  }

  @Get('gratitude/:id')
  getGratitudeDiaryEntry(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.diaryService.getGratitudeDiaryEntry(uid(req), id32(id));
  }

  @Delete('gratitude/:id')
  async deleteGratitudeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteGratitudeDiaryEntry(uid(req), id32(id));
    return { ok: true };
  }
}
