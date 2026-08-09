// Межустройственная синхронизация настроек кастомизации мини-аппа. Реестр
// видимости/порядка (фокус «Сегодня», quick actions, скрытые/переставленные
// блоки экранов) жил только per-device в localStorage — на новом устройстве
// юзер видел дефолт. Бэкенд хранит плоский объект «ключ → строка из
// localStorage» в User.uiPrefs (settings-эндпоинт). Контракт зафиксирован:
// SYNCED_PREF_KEYS парсит бэкенд-спека fs-ом — менять состав/формат только
// синхронно с бэкендом, по ключу на строке.
import { api } from '../api';

export const SYNCED_PREF_KEYS = [
  'today_focus_practice',
  'today_streak_hidden',
  'today_phrase_hidden',
  'today_secondary_hidden',
  'today_therapist_banner_hidden',
  'quick_actions_hidden_plus',
  'quick_actions_order_plus',
  'quick_actions_hidden_tools',
  'quick_actions_order_tools',
  'screen_hidden_profile',
  'screen_hidden_patterns',
  'screen_order_profile',
  'screen_order_patterns',
] as const;

export type SyncedPrefKey = (typeof SYNCED_PREF_KEYS)[number];
export type UiPrefsPatch = Partial<Record<SyncedPrefKey, string>>;

/** Хранилище-интерфейс — localStorage подходит без адаптера, тесты дают фейк. */
export interface PrefStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Присутствующие в storage ключи реестра — плоский объект для отправки. */
export function collectPrefs(read: PrefStorage): UiPrefsPatch {
  const out: UiPrefsPatch = {};
  for (const key of SYNCED_PREF_KEYS) {
    const v = read.getItem(key);
    if (v !== null) out[key] = v;
  }
  return out;
}

/** Server wins: пишет присланные значения, удаляет ключи РЕЕСТРА без ответа; ключи localStorage вне реестра не трогает. */
export function applyServerPrefs(
  prefs: UiPrefsPatch,
  storage: PrefStorage,
): void {
  for (const key of SYNCED_PREF_KEYS) {
    const v = prefs[key];
    if (v === undefined) storage.removeItem(key);
    else storage.setItem(key, v);
  }
}

// Маркер «устройство уже хоть раз синхронизировалось» — НЕ ключ реестра
// (не уходит на сервер, collectPrefs/applyServerPrefs его не видят). Нужен,
// потому что GET /api/settings отдаёт uiPrefs ВСЕГДА объектом, никогда null
// (см. SettingsController.getSettings, ?? {}) — пустой ответ означает и
// «сервер ещё не видел это устройство» (надо мигрировать локальное), и
// «уже синхронизировано, реально пусто» (надо применить как есть, стереть
// локальное). Различаем по этому локальному флагу, а не по ответу сервера —
// иначе первая же загрузка после деплоя стирала бы кастомизацию всем, у кого
// она только локальная (server wins над пустым ответом).
const MIGRATED_KEY = 'ui_prefs_migrated';

const DEBOUNCE_MS = 1500;
let timer: ReturnType<typeof setTimeout> | null = null;

function pushNow(): void {
  timer = null;
  try {
    void api
      .updateSettings({ uiPrefs: collectPrefs(localStorage) })
      .then(() => localStorage.setItem(MIGRATED_KEY, '1'))
      .catch(() => {});
  } catch {
    /* fire-and-forget, как trackEvent — синхронизация не мешает UI */
  }
}

/** Вызывать из ЛЮБОЙ точки записи ключа реестра — планирует debounce-пуш,
 * схлопывающий серию мутаций подряд в один вызов сервера. */
export function notifyPrefsChanged(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(pushNow, DEBOUNCE_MS);
}

/**
 * Вызывать один раз при старте с серверным uiPrefs (ответ GET /api/settings).
 * Пустой ответ И устройство ещё не мигрировало → локальные ключи реестра
 * есть — пушим немедленно (pushNow сам отметит миграцию по успеху); пусто
 * локально — мигрировать нечего, отмечаем сразу. Иначе (реальные данные ИЛИ
 * уже мигрировали раньше) — server wins: применяем и НЕ пушим обратно то,
 * что только что применили.
 */
export function syncFromServer(prefs: UiPrefsPatch | null | undefined): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const server = prefs ?? {};
  const migrated = localStorage.getItem(MIGRATED_KEY) === '1';
  if (!migrated && Object.keys(server).length === 0) {
    if (Object.keys(collectPrefs(localStorage)).length > 0) pushNow();
    else localStorage.setItem(MIGRATED_KEY, '1');
    return;
  }
  applyServerPrefs(server, localStorage);
  localStorage.setItem(MIGRATED_KEY, '1');
}
