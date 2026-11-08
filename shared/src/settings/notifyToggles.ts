import type { UserSettings } from '../apiTypes';

// Два тумблера раздела «Уведомления» (R2, аудит 2026-11, решение владельца Р1).
// Раньше «Итоги дня» висели на notifyEnabled: выключил — пропадали напоминания
// (полуночный планировщик берёт только notifyEnabled), а сводка приходила.
//
// «Напоминания» — всё, что бот пишет сам: напоминание в выбранный час, «давно
// не заходил», недельная сводка. На сервере это notifyEnabled и, для самого
// напоминания, notifyReminderEnabled — тумблер показывает оба сразу и
// включает оба, чтобы ни один не остался выключенным без переключателя.
// «Итоги дня» — notifySummaryEnabled: сводка после заполнения, вехи серии и
// «с возвращением» (src/telegram/telegram.diary-complete.ts).

type Flags = Pick<
  UserSettings,
  'notifyEnabled' | 'notifyReminderEnabled' | 'notifySummaryEnabled'
>;

export function remindersOn(s: Flags): boolean {
  return s.notifyEnabled && s.notifyReminderEnabled;
}

export function remindersPatch(on: boolean): Partial<UserSettings> {
  return on
    ? { notifyEnabled: true, notifyReminderEnabled: true }
    : { notifyEnabled: false };
}

/** Старый ответ сервера без поля — итоги включены, как было до тумблера. */
export function summaryOn(s: Flags): boolean {
  return s.notifySummaryEnabled !== false;
}
