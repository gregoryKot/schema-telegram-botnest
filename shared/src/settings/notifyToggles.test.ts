// Два тумблера уведомлений (R2, аудит 2026-11): что показывает и что пишет
// каждый. «Напоминания» — оба серверных флага сразу, «Итоги дня» — свой.
import { describe, it, expect } from 'vitest';
import { remindersOn, remindersPatch, summaryOn } from './notifyToggles';

const flags = (
  notifyEnabled: boolean,
  notifyReminderEnabled: boolean,
  notifySummaryEnabled?: boolean,
) => ({
  notifyEnabled,
  notifyReminderEnabled,
  notifySummaryEnabled,
});

describe('notifyToggles', () => {
  it('«Напоминания» включены, только когда включены оба серверных флага', () => {
    expect(remindersOn(flags(true, true))).toBe(true);
    expect(remindersOn(flags(true, false))).toBe(false);
    expect(remindersOn(flags(false, true))).toBe(false);
  });

  it('включение поднимает оба флага, выключение — только notifyEnabled', () => {
    expect(remindersPatch(true)).toEqual({
      notifyEnabled: true,
      notifyReminderEnabled: true,
    });
    expect(remindersPatch(false)).toEqual({ notifyEnabled: false });
  });

  it('«Итоги дня» не зависят от напоминаний; нет поля в ответе — включены', () => {
    expect(summaryOn(flags(false, false, true))).toBe(true);
    expect(summaryOn(flags(true, true, false))).toBe(false);
    expect(summaryOn(flags(true, true))).toBe(true);
  });
});
