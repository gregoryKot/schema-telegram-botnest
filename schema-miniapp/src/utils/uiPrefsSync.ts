// Синхронизация настроек кастомизации мини-аппа с сервером: вся логика и
// реестр ключей SYNCED_PREF_KEYS — в shared/src/prefs/uiPrefsSync.ts (общая с
// сайтом); здесь только подключение api мини-аппа.
import { api } from '../api';
import { createUiPrefsSync } from '../../../shared/src/prefs/uiPrefsSync';

export {
  SYNCED_PREF_KEYS,
  collectPrefs,
  applyServerPrefs,
  type PrefStorage,
  type SyncedPrefKey,
  type UiPrefsPatch,
} from '../../../shared/src/prefs/uiPrefsSync';

const sync = createUiPrefsSync({ api });

/** Вызывать из ЛЮБОЙ точки записи ключа реестра. */
export const notifyPrefsChanged = sync.notifyPrefsChanged;
/** Один раз при старте с uiPrefs из GET /api/settings. */
export const syncFromServer = sync.syncFromServer;
