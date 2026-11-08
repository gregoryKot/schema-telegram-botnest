// Тумблеры «Напоминания» и «Итоги дня» (R2, аудит 2026-11, решение Р1) для
// /settings бота. Копия shared/src/settings/notifyToggles.ts — бэкенд не
// импортирует shared/ (rootDir — src); сверку держит notify-toggles.sync.spec.ts
// (правило №4). «Напоминания» — оба серверных флага: notifyEnabled
// (планировщик) и notifyReminderEnabled (само напоминание).

type Flags = { notifyEnabled?: boolean; notifyReminderEnabled?: boolean };

export function remindersOn(s: Flags | null | undefined): boolean {
  return (s?.notifyEnabled ?? true) && (s?.notifyReminderEnabled ?? true);
}

export function remindersPatch(on: boolean): Flags {
  return on
    ? { notifyEnabled: true, notifyReminderEnabled: true }
    : { notifyEnabled: false };
}
