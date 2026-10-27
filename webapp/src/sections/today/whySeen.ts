import { readLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';
import { notifyPrefsChanged } from '../../utils/uiPrefsSync';

// Флаг «объяснение „Зачем это всё“ показано». Живёт в prefs пользователя
// (SYNCED_PREF_KEYS в shared/src/prefs/uiPrefsSync.ts, белый список на бэке —
// src/api/ui-prefs.sanitize.ts), а не только в localStorage: данные общие между
// устройствами, новичок не должен видеть «Первый раз здесь» на втором телефоне.
export const WHY_SEEN_KEY = 'why_seen_v1';

export function isWhySeen(): boolean {
  return readLocal(WHY_SEEN_KEY) === '1';
}

export function markWhySeen(): void {
  writeLocal(WHY_SEEN_KEY, '1');
  notifyPrefsChanged();
}
