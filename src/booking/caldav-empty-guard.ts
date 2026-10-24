// Пустой список календарей при включённом CalDAV — это СБОЙ, а не «занято 0»
// (инцидент 2026-09-16, регресс PR #491): getBusyTimes молча возвращал [] до
// трекера здоровья, авария не открывалась, /stats показывал «сбоев не было».
// Вынесено отдельно, чтобы не раздувать caldav.service.ts (правило №10).
import { Logger } from '@nestjs/common';
import { calDavHealth } from './caldav-health';
import { Interval } from './caldav-busy';

const logger = new Logger('CalDavService');

/**
 * iCloud отвечает, но ни один календарь не прошёл фильтр — открывает аварию
 * (детерминированная, как 'auth': ждать «повезёт в следующий раз» бессмысленно)
 * и возвращает [] (fail-open — слоты не блокируются битым списком).
 */
export function onEmptyCalendars(): Interval[] {
  logger.warn('CalDAV busy read: список календарей пуст (0 прошли фильтр)');
  const alert = calDavHealth.noteFailure(
    'empty',
    'список календарей пуст — подробности в логе CalDavDiscovery выше',
  );
  if (alert) logger.error(alert);
  return [];
}
