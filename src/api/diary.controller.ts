import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { DiaryService } from '../bot/diary.service';
import { TherapyService } from '../therapy/therapy.service';

interface AuthRequest extends Request {
  telegramUserId: number;
}

function parseId(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Invalid id');
  return n;
}

@Controller('api/diary')
@UseGuards(TelegramAuthGuard)
export class DiaryController {
  constructor(
    private readonly diaryService: DiaryService,
    private readonly therapyService: TherapyService,
  ) {}

  // ─── Schema Diary ─────────────────────────────────────────────────────────

  @Get('schema')
  getSchemaDiary(@Req() req: AuthRequest) {
    return this.diaryService.getSchemaDiaryEntries(BigInt(req.telegramUserId));
  }

  @Post('schema')
  async createSchemaDiary(@Req() req: AuthRequest, @Body() body: {
    trigger: string;
    emotions: { id: string; intensity: number }[];
    thoughts?: string;
    bodyFeelings?: string;
    actualBehavior?: string;
    schemaIds: string[];
    schemaOrigin?: string;
    healthyView?: string;
    realProblems?: string;
    excessiveReactions?: string;
    healthyBehavior?: string;
  }) {
    if (!body.trigger?.trim()) throw new BadRequestException('trigger required');
    if (!Array.isArray(body.emotions) || body.emotions.length > 50) throw new BadRequestException('emotions required');
    if (!Array.isArray(body.schemaIds) || body.schemaIds.length > 50) throw new BadRequestException('schemaIds required');
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
    const entry = await this.diaryService.createSchemaDiaryEntry(BigInt(req.telegramUserId), trimmed);
    this.therapyService.checkStreakTasks(req.telegramUserId).catch(() => null);
    return entry;
  }

  @Delete('schema/:id')
  async deleteSchemaDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteSchemaDiaryEntry(BigInt(req.telegramUserId), parseId(id));
    return { ok: true };
  }

  // ─── Mode Diary ───────────────────────────────────────────────────────────

  @Get('mode')
  getModeDiary(@Req() req: AuthRequest) {
    return this.diaryService.getModeDiaryEntries(BigInt(req.telegramUserId));
  }

  @Post('mode')
  async createModeDiary(@Req() req: AuthRequest, @Body() body: {
    modeId: string;
    situation: string;
    thoughts?: string;
    feelings?: string;
    bodyFeelings?: string;
    actions?: string;
    actualNeed?: string;
    childhoodMemories?: string;
  }) {
    if (!body.modeId?.trim()) throw new BadRequestException('modeId required');
    if (!body.situation?.trim()) throw new BadRequestException('situation required');
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
    const entry = await this.diaryService.createModeDiaryEntry(BigInt(req.telegramUserId), trimmedMode);
    this.therapyService.checkStreakTasks(req.telegramUserId).catch(() => null);
    return entry;
  }

  @Delete('mode/:id')
  async deleteModeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteModeDiaryEntry(BigInt(req.telegramUserId), parseId(id));
    return { ok: true };
  }

  // ─── Gratitude Diary ──────────────────────────────────────────────────────

  @Get('gratitude')
  getGratitudeDiary(@Req() req: AuthRequest) {
    return this.diaryService.getGratitudeDiaryEntries(BigInt(req.telegramUserId));
  }

  @Post('gratitude')
  async createGratitudeDiary(@Req() req: AuthRequest, @Body() body: { date: string; items: string[] }) {
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new BadRequestException('Invalid date');
    if (!Array.isArray(body.items) || body.items.length === 0) throw new BadRequestException('items required');
    if (body.items.length > 20) throw new BadRequestException('Too many items');
    const items = body.items.map((s: string) => String(s).slice(0, 500));
    const entry = await this.diaryService.upsertGratitudeDiaryEntry(BigInt(req.telegramUserId), body.date, items);
    this.therapyService.checkStreakTasks(req.telegramUserId).catch(() => null);
    return entry;
  }

  @Delete('gratitude/:id')
  async deleteGratitudeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteGratitudeDiaryEntry(BigInt(req.telegramUserId), parseId(id));
    return { ok: true };
  }
}
