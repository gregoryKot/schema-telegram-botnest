// Серверная синхронизация настроек экранов сайта — подключение api сайта к
// общему синхронизатору (shared/src/prefs/uiPrefsSync.ts; мини-апп:
// schema-miniapp/src/utils/uiPrefsSync.ts). Ключи localStorage те же, что у
// мини-аппа, поэтому настройка ходит между площадками и устройствами.
//
// requireInitialSync: сервер заменяет uiPrefs целиком, а у сайта на этом
// устройстве может быть неполный набор ключей — пуш до первого ответа сервера
// стёр бы настройки, сделанные в мини-аппе. Пока UiPrefsGate не получил и не
// применил ответ GET /api/settings, notifyPrefsChanged ничего не отправляет.
import { api } from '../api';
import { createUiPrefsSync } from '../../../shared/src/prefs/uiPrefsSync';

const sync = createUiPrefsSync({ api, requireInitialSync: true });

/** Вызывать из ЛЮБОЙ точки записи ключа настройки экрана. */
export const notifyPrefsChanged: () => void = sync.notifyPrefsChanged;
/** Один раз при старте сессии с uiPrefs из GET /api/settings (UiPrefsGate). */
export const syncFromServer = sync.syncFromServer;
/** Новая сессия: снять отложенный пуш и закрыть отправку до ответа сервера. */
export const resetUiPrefsSync = sync.reset;
