import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { DiaryService } from '../bot/diary.service';

interface AuthRequest extends Request {
  telegramUserId: number;
}

@Controller('api/diary')
@UseGuards(TelegramAuthGuard)
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  // ─── Schema Diary ─────────────────────────────────────────────────────────

  @Get('schema')
  getSchemaDiary(@Req() req: AuthRequest) {
    return this.diaryService.getSchemaDiaryEntries(BigInt(req.telegramUserId));
  }

  @Post('schema')
  async createSchemaDiary(@Req() req: AuthRequest, @Body() body: {
    situation: string;
    emotions: { id: string; intensity: number }[];
    emotionNote?: string;
    bodyFeelings?: string;
    thoughts?: string;
    schemaIds: string[];
    copingModeId?: string;
    healthyAdult?: string;
  }) {
    if (!body.situation?.trim()) throw new BadRequestException('situation required');
    if (!Array.isArray(body.emotions)) throw new BadRequestException('emotions required');
    if (!Array.isArray(body.schemaIds)) throw new BadRequestException('schemaIds required');
    return this.diaryService.createSchemaDiaryEntry(BigInt(req.telegramUserId), body);
  }

  @Delete('schema/:id')
  async deleteSchemaDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteSchemaDiaryEntry(BigInt(req.telegramUserId), parseInt(id));
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
    trigger: string;
    intensity: number;
    healthyAdult?: string;
  }) {
    if (!body.modeId?.trim()) throw new BadRequestException('modeId required');
    if (!body.trigger?.trim()) throw new BadRequestException('trigger required');
    if (!Number.isInteger(body.intensity) || body.intensity < 1 || body.intensity > 10) {
      throw new BadRequestException('intensity must be 1-10');
    }
    return this.diaryService.createModeDiaryEntry(BigInt(req.telegramUserId), body);
  }

  @Delete('mode/:id')
  async deleteModeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteModeDiaryEntry(BigInt(req.telegramUserId), parseInt(id));
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
    return this.diaryService.upsertGratitudeDiaryEntry(BigInt(req.telegramUserId), body.date, body.items);
  }

  @Delete('gratitude/:id')
  async deleteGratitudeDiary(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.diaryService.deleteGratitudeDiaryEntry(BigInt(req.telegramUserId), parseInt(id));
    return { ok: true };
  }
}
