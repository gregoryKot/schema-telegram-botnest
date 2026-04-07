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
    if (!Array.isArray(body.emotions)) throw new BadRequestException('emotions required');
    if (!Array.isArray(body.schemaIds)) throw new BadRequestException('schemaIds required');
    const entry = await this.diaryService.createSchemaDiaryEntry(BigInt(req.telegramUserId), body);
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
    const entry = await this.diaryService.createModeDiaryEntry(BigInt(req.telegramUserId), body);
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
    const entry = await this.diaryService.upsertGratitudeDiaryEntry(BigInt(req.telegramUserId), body.date, body.items);
    this.therapyService.checkStreakTasks(req.telegramUserId).catch(() => null);
    return entry;
  }

  @Delete('gratitude/:id')
  async deleteGratitudeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteGratitudeDiaryEntry(BigInt(req.telegramUserId), parseId(id));
    return { ok: true };
  }
}
