import type { UserSettings } from '../../../../shared/src/apiTypes';

/** Решение «показывать подсказку»: флага нет, настройки загружены, вечернее напоминание включено. */
export function shouldShowReminderHint(
  seen: boolean,
  settings: Pick<UserSettings, 'notifyEnabled' | 'notifyReminderEnabled'> | null,
): boolean {
  if (seen || !settings) return false;
  return settings.notifyEnabled && settings.notifyReminderEnabled;
}

export function reminderTime(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
