// Тело /admin/status без календарной части — вынесено из
// booking-admin.controller.ts (правило №10: тот не растёт). Секретов нет.
import { ConfigService } from '@nestjs/config';
import { CalendarStatus } from './booking-admin.calendar';
import { MeetingService } from './meeting.service';
import { RobokassaService } from './robokassa.service';

export function buildAdminStatus(
  config: ConfigService,
  meeting: MeetingService,
  robokassa: RobokassaService,
  cal: CalendarStatus,
) {
  const m = meeting.status;
  return {
    siteUrl: config.get<string>('SITE_URL') ?? '(default kotlarewski.gr)',
    appUrl: config.get<string>('APP_URL') ?? '(default schemehappens.ru)',
    robokassa: robokassa.enabled,
    robokassaTest: config.get<string>('ROBOKASSA_IS_TEST') === 'true',
    zoom: m.zoom,
    zoomVars: m.zoomVars,
    meetingStaticUrl: m.staticUrl,
    ...cal,
    calendarBlocking: config.get<string>('CALENDAR_BLOCK_SLOTS') === 'true',
    emailFallback:
      !!config.get<string>('POSTBOX_ACCESS_KEY_ID') &&
      !!config.get<string>('POSTBOX_SECRET_ACCESS_KEY') &&
      !!config.get<string>('ADMIN_EMAIL'),
  };
}
