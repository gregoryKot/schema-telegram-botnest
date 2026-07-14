import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { uid } from './request-utils';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { VALID_TIMEZONES } from '../telegram/telegram.constants';
import { UpdateSettingsDto } from './dto/settings.dto';

interface AuthRequest extends Request {
  webUser: { userId: bigint };
}

// Настройки уведомлений и профиля юзера (тихие часы, форма обращения,
// коллекции карточек, доступ терапевта к профилю).
@Controller('api')
@UseGuards(TelegramAuthGuard)
export class SettingsController {
  constructor(
    private readonly botService: BotService,
    private readonly accountService: AccountService,
    private readonly scheduleService: TelegramScheduleService,
  ) {}

  @Get('settings')
  async getSettings(@Req() req: AuthRequest) {
    const s = await this.botService.getUserSettings(uid(req));
    return {
      notifyEnabled: s?.notifyEnabled ?? true,
      notifyLocalHour: s?.notifyLocalHour ?? 21,
      notifyTimezone: s?.notifyTimezone ?? 'Europe/Moscow',
      notifyReminderEnabled: s?.notifyReminderEnabled ?? true,
      notifyFrequency: s?.notifyFrequency ?? 0,
      notifyQuietStart: s?.notifyQuietStart ?? 22,
      notifyQuietEnd: s?.notifyQuietEnd ?? 8,
      notifyGamified: s?.notifyGamified ?? false,
      notifyPausedUntil: s?.notifyPausedUntil?.toISOString() ?? null,
      addressForm: s?.addressForm ?? null,
      pairCardDismissed: s?.pairCardDismissed ?? false,
      mySchemaIds: Array.isArray(s?.mySchemaIds)
        ? (s.mySchemaIds as string[])
        : [],
      myModeIds: Array.isArray(s?.myModeIds) ? (s.myModeIds as string[]) : [],
      therapistShareCards: s?.therapistShareCards ?? true,
      therapistShareProfile: s?.therapistShareProfile ?? true,
    };
  }

  @Post('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: UpdateSettingsDto,
  ) {
    const clean: Parameters<typeof this.botService.updateUserSettings>[1] = {};
    if (typeof body.notifyEnabled === 'boolean')
      clean.notifyEnabled = body.notifyEnabled;
    if (typeof body.notifyReminderEnabled === 'boolean')
      clean.notifyReminderEnabled = body.notifyReminderEnabled;
    if (typeof body.notifyGamified === 'boolean')
      clean.notifyGamified = body.notifyGamified;
    if (typeof body.pairCardDismissed === 'boolean')
      clean.pairCardDismissed = body.pairCardDismissed;
    if (
      Number.isInteger(body.notifyLocalHour) &&
      body.notifyLocalHour! >= 0 &&
      body.notifyLocalHour! <= 23
    )
      clean.notifyLocalHour = body.notifyLocalHour;
    if (
      typeof body.notifyTimezone === 'string' &&
      VALID_TIMEZONES.includes(body.notifyTimezone)
    )
      clean.notifyTimezone = body.notifyTimezone;
    if (
      Number.isInteger(body.notifyFrequency) &&
      body.notifyFrequency! >= 0 &&
      body.notifyFrequency! <= 3
    )
      clean.notifyFrequency = body.notifyFrequency;
    if (
      Number.isInteger(body.notifyQuietStart) &&
      body.notifyQuietStart! >= 0 &&
      body.notifyQuietStart! <= 23
    )
      clean.notifyQuietStart = body.notifyQuietStart;
    if (
      Number.isInteger(body.notifyQuietEnd) &&
      body.notifyQuietEnd! >= 0 &&
      body.notifyQuietEnd! <= 23
    )
      clean.notifyQuietEnd = body.notifyQuietEnd;
    // Возобновление паузы из UI: единственное допустимое значение — null
    if (body.notifyPausedUntil === null) clean.notifyPausedUntil = null;
    if (body.addressForm === 'ty' || body.addressForm === 'vy')
      clean.addressForm = body.addressForm;
    if (
      Array.isArray(body.mySchemaIds) &&
      body.mySchemaIds.length <= 200 &&
      body.mySchemaIds.every((id) => typeof id === 'string' && id.length < 100)
    )
      clean.mySchemaIds = body.mySchemaIds;
    if (
      Array.isArray(body.myModeIds) &&
      body.myModeIds.length <= 200 &&
      body.myModeIds.every((id) => typeof id === 'string' && id.length < 100)
    )
      clean.myModeIds = body.myModeIds;
    if (typeof body.therapistShareCards === 'boolean')
      clean.therapistShareCards = body.therapistShareCards;
    if (typeof body.therapistShareProfile === 'boolean')
      clean.therapistShareProfile = body.therapistShareProfile;
    await this.botService.updateUserSettings(uid(req), clean);

    // Явный выбор частоты сбрасывает адаптацию на выбранный уровень
    if ('notifyFrequency' in clean) {
      await this.accountService.setAdaptiveLevel(
        uid(req),
        clean.notifyFrequency!,
      );
    }

    // Reschedule reminder if notification time/toggle changed
    if (
      'notifyEnabled' in clean ||
      'notifyLocalHour' in clean ||
      'notifyTimezone' in clean ||
      'notifyReminderEnabled' in clean ||
      'notifyFrequency' in clean ||
      'notifyPausedUntil' in clean
    ) {
      await this.scheduleService.rescheduleForUser(uid(req));
    }

    return { ok: true };
  }
}
