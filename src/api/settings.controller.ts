import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { uid } from './request-utils';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { TelegramScheduleService } from '../telegram/telegram.schedule.service';
import { isNotifyTimezone } from '../notification/notify-timezones';
import { UpdateSettingsDto } from './dto/settings.dto';
import { sanitizeUiPrefs } from './ui-prefs.sanitize';
import { BOOLEAN_SETTINGS, RESCHEDULE_ON } from './settings-fields';

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
    const [s, route] = await Promise.all([
      this.botService.getUserSettings(uid(req)),
      this.accountService.notifyRoute(uid(req)),
    ]);
    return {
      notifyEnabled: s?.notifyEnabled ?? true,
      notifyLocalHour: s?.notifyLocalHour ?? 21,
      notifyTimezone: s?.notifyTimezone ?? 'Europe/Moscow',
      notifyReminderEnabled: s?.notifyReminderEnabled ?? true,
      notifySummaryEnabled: s?.notifySummaryEnabled ?? true,
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
      // sanitizeUiPrefs повторно фильтрует и на чтение — защита от того, что
      // в колонке лежит устаревшая/битая форма (например ключ, выведенный
      // из SYNCED_PREF_KEYS в более старой версии контракта).
      uiPrefs: sanitizeUiPrefs(s?.uiPrefs) ?? {},
      // Куда очередь пошлёт уведомление сейчас (notify-channel.ts): 'push' —
      // в приложение, 'telegram', null — некуда; экран не обещает
      // напоминаний, которые не придут (QA 2026-11, З5).
      notifyChannel: route.channel,
      notifyReachable: route.channel !== null,
      telegramLinked: route.telegramLinked,
    };
  }

  @Post('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() body: UpdateSettingsDto,
  ) {
    const clean: Parameters<typeof this.botService.updateUserSettings>[1] = {};
    for (const key of BOOLEAN_SETTINGS)
      if (typeof body[key] === 'boolean') clean[key] = body[key];
    if (
      Number.isInteger(body.notifyLocalHour) &&
      body.notifyLocalHour! >= 0 &&
      body.notifyLocalHour! <= 23
    )
      clean.notifyLocalHour = body.notifyLocalHour;
    if (isNotifyTimezone(body.notifyTimezone))
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
    if (body.uiPrefs !== undefined) {
      const prefs = sanitizeUiPrefs(body.uiPrefs);
      if (prefs) clean.uiPrefs = prefs;
    }
    await this.botService.updateUserSettings(uid(req), clean);

    // Явный выбор частоты сбрасывает адаптацию на выбранный уровень
    if ('notifyFrequency' in clean) {
      await this.accountService.setAdaptiveLevel(
        uid(req),
        clean.notifyFrequency!,
      );
    }

    // Reschedule reminder if notification time/toggle changed; выключенные
    // «Итоги дня» снимают стоящую сводку там же (rescheduleForUser).
    if (RESCHEDULE_ON.some((key) => key in clean))
      await this.scheduleService.rescheduleForUser(uid(req));

    return { ok: true };
  }
}
