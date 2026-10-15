// Тело /admin/status без календарной части — вынесено из
// booking-admin.controller.ts (правило №10: файл под храповиком размера не
// растёт, а новой ручке отмены нужно место). Секретов в ответе нет.
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
      !!config.get<string>('RESEND_API_KEY') &&
      !!config.get<string>('ADMIN_EMAIL'),
  };
}
