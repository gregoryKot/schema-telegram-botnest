// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { reminderTime, shouldShowReminderHint } from './reminderHintRules';
import { hasReminderHintSeen, markReminderHintSeen } from './reminderHintSeen';

const on = { notifyEnabled: true, notifyReminderEnabled: true };

describe('shouldShowReminderHint', () => {
  it('показываем при включённом напоминании без флага', () => {
    expect(shouldShowReminderHint(false, on)).toBe(true);
  });
  it('не показываем: флаг стоит, настройки не загрузились, напоминание выключено', () => {
    expect(shouldShowReminderHint(true, on)).toBe(false);
    expect(shouldShowReminderHint(false, null)).toBe(false);
    expect(shouldShowReminderHint(false, { ...on, notifyReminderEnabled: false })).toBe(false);
    expect(shouldShowReminderHint(false, { ...on, notifyEnabled: false })).toBe(false);
  });
  it('час с ведущим нулём', () => {
    expect(reminderTime(9)).toBe('09:00');
    expect(reminderTime(21)).toBe('21:00');
  });
});

describe('reminderHintSeen', () => {
  beforeEach(() => localStorage.clear());
  it('сохранил → нашёл', () => {
    expect(hasReminderHintSeen()).toBe(false);
    markReminderHintSeen();
    expect(hasReminderHintSeen()).toBe(true);
  });
});
