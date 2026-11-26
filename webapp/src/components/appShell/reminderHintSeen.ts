import { readLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';

// «Про вечернее напоминание уже сказали» — один модуль-владелец ключа (scripts/local-cache-baseline.json).
const KEY = 'reminder_hint_seen';

export function markReminderHintSeen(): void {
  writeLocal(KEY, '1');
}

export function hasReminderHintSeen(): boolean {
  return readLocal(KEY) === '1';
}
