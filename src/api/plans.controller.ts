import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { uid, parseId } from './request-utils';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { PracticesService } from '../bot/practices.service';
import { NotificationService } from '../notification/notification.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { CheckinDto } from './dto/misc.dto';
import { AddPracticeDto, CreatePlanDto } from './dto/practice-plan.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Практики (заметки-упражнения на потребность) и планы (запланированная
// практика на завтра + чек-ин выполнения + напоминание).
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class PlansController {
  constructor(
    private readonly botService: BotService,
    private readonly practicesService: PracticesService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── Practices ────────────────────────────────────────────────────────────

  @Get('practices')
  async getPractices(@Req() req: AuthRequest, @Query('needId') needId: string) {
    if (!NEED_IDS.includes(needId as NeedId))
      throw new BadRequestException('Invalid needId');
    const rows = await this.practicesService.getPractices(uid(req), needId);
    return rows;
  }

  @Post('practices')
  async addPractice(@Req() req: AuthRequest, @Body() body: AddPracticeDto) {
    const row = await this.practicesService.addPractice(
      uid(req),
      body.needId,
      body.text.trim().slice(0, 200),
    );
    return row;
  }

  @Delete('practices/:id')
  async deletePractice(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.practicesService.deletePractice(uid(req), parseId(id));
    return { ok: true };
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plan/pending')
  async getPendingPlans(@Req() req: AuthRequest) {
    const tz =
      (await this.botService.getUserSettings(uid(req)))?.notifyTimezone ??
      'Europe/Moscow';
    const today = this.localDate(tz);
    const plans = await this.practicesService.getPendingPlans(uid(req), today);
    return plans;
  }

  @Post('plan')
  async createPlan(@Req() req: AuthRequest, @Body() body: CreatePlanDto) {
    const settings = await this.botService.getUserSettings(uid(req));
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const tomorrow = this.localDate(tz, 1);
    const plan = await this.practicesService.createPlan(
      uid(req),
      body.needId,
      body.practiceText.trim(),
      tomorrow,
      body.reminderUtcHour,
    );
    if (body.reminderUtcHour !== undefined) {
      const sendAt = new Date();
      sendAt.setUTCDate(sendAt.getUTCDate() + 1);
      sendAt.setUTCHours(body.reminderUtcHour, 0, 0, 0);
      await this.notificationService.schedule(
        uid(req),
        'practice_reminder',
        sendAt,
        {
          practiceText: body.practiceText.trim(),
          needId: body.needId,
          planId: plan.id,
        },
      );
    }
    return plan;
  }

  @Post('plan/:id/checkin')
  async checkinPlan(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: CheckinDto,
  ) {
    await this.practicesService.checkinPlan(uid(req), parseId(id), body.done);
    return { ok: true };
  }

  @Get('plans/history')
  async getPlanHistory(@Req() req: AuthRequest, @Query('days') days?: string) {
    // 365: архив «Мой путь» тянет текст практики и для старых записей
    const n = Math.min(Number(days) || 30, 365);
    return this.practicesService.getPlanHistory(uid(req), n);
  }

  private localDate(tz: string, daysAhead = 0): string {
    const d = new Date(Date.now() + daysAhead * 86_400_000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
}
