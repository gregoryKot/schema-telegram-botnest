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
import { localDate } from '../utils/tz';
import { planDay, planReminderAt } from './plan-reminder';

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
      body.text.trim(),
    );
    return row;
  }

  @Delete('practices/:id')
  async deletePractice(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.practicesService.deletePractice(
      uid(req),
      parseId(id, { int32: true }),
    );
    return { ok: true };
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  @Get('plan/pending')
  async getPendingPlans(@Req() req: AuthRequest) {
    const tz =
      (await this.botService.getUserSettings(uid(req)))?.notifyTimezone ??
      'Europe/Moscow';
    const today = localDate(tz);
    const plans = await this.practicesService.getPendingPlans(uid(req), today);
    return plans;
  }

  // Шаг плана по id: «Мой путь» открывает и запись старше окна истории (год).
  @Get('plan/:id')
  getPlan(@Req() req: AuthRequest, @Param('id') id: string) {
    const planId = parseId(id, { int32: true });
    return this.practicesService.getPlan(uid(req), planId);
  }

  @Post('plan')
  async createPlan(@Req() req: AuthRequest, @Body() body: CreatePlanDto) {
    const settings = await this.botService.getUserSettings(uid(req));
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const tomorrow = planDay(tz);
    // Момент — стенные часы дня плана в поясе человека (E11, plan-reminder.ts).
    const sendAt = planReminderAt(tomorrow, tz, {
      localHour: body.reminderLocalHour,
      utcHour: body.reminderUtcHour,
    });
    const plan = await this.practicesService.createPlan(
      uid(req),
      body.needId,
      body.practiceText.trim(),
      tomorrow,
      sendAt?.getUTCHours(),
    );
    if (sendAt) {
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
    await this.practicesService.checkinPlan(
      uid(req),
      parseId(id, { int32: true }),
      body.done,
    );
    return { ok: true };
  }

  @Get('plans/history')
  async getPlanHistory(@Req() req: AuthRequest, @Query('days') days?: string) {
    const n = Math.min(Number(days) || 30, 365); // запись «Пути» — plan/:id
    return this.practicesService.getPlanHistory(uid(req), n);
  }
}
