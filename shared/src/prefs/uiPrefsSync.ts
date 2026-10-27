// Межустройственная синхронизация настроек кастомизации экранов (фокус
// «Сегодня», быстрые действия «+», скрытые/переставленные блоки). Живёт в
// shared: мини-апп и сайт — тонкие обёртки над createUiPrefsSync (api и
// хранилище приходят снаружи). Бэкенд хранит плоский объект «ключ → строка из
// localStorage» в User.uiPrefs и заменяет его ЦЕЛИКОМ. Контракт зафиксирован:
// SYNCED_PREF_KEYS парсит бэкенд-спека fs-ом
// (src/security/ui-prefs-sync.invariants.spec.ts) — менять состав/формат только
// синхронно с бэкендом, по ключу на строке.
import { readLocal, removeLocal, writeLocal } from '../utils/safeLocalStorage';

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
  'screen_order_today',
  'why_seen_v1',
] as const;

export type SyncedPrefKey = (typeof SYNCED_PREF_KEYS)[number];
export type UiPrefsPatch = Partial<Record<SyncedPrefKey, string>>;

/** Хранилище-интерфейс — localStorage подходит без адаптера, тесты дают фейк. */
export interface PrefStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage, переживающий отказ хранилища (приватный режим, квота). */
export const localPrefStorage: PrefStorage = {
  getItem: readLocal,
  setItem: (k, v) => void writeLocal(k, v),
  removeItem: (k) => void removeLocal(k),
};

/** Присутствующие в storage ключи реестра — плоский объект для отправки. */
export function collectPrefs(read: PrefStorage): UiPrefsPatch {
  const out: UiPrefsPatch = {};
  for (const key of SYNCED_PREF_KEYS) {
    const v = read.getItem(key);
    if (v !== null) out[key] = v;
  }
  return out;
}

/** Server wins: пишет присланные значения, удаляет ключи РЕЕСТРА без ответа; ключи вне реестра не трогает. */
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
// (SettingsController.getSettings, `?? {}`) — пустой ответ означает и «сервер
// ещё не видел это устройство» (надо мигрировать локальное), и «уже
// синхронизировано, реально пусто» (надо применить как есть). Различаем по
// локальному флагу, а не по ответу — иначе первая же загрузка после деплоя
// стирала бы кастомизацию всем, у кого она только локальная.
const MIGRATED_KEY = 'ui_prefs_migrated';

export interface UiPrefsApi {
  updateSettings(body: { uiPrefs: UiPrefsPatch }): Promise<unknown>;
}

export interface UiPrefsSyncOptions {
  api: UiPrefsApi;
  storage?: PrefStorage;
  debounceMs?: number;
  /**
   * true — до первого syncFromServer ничего не уходит на сервер. Сервер
   * заменяет uiPrefs целиком: пуш неполного набора ключей до ответа стёр бы
   * настройки, сделанные на другой площадке (сайт). Мини-апп оставляет false.
   */
  requireInitialSync?: boolean;
}

export interface UiPrefsSync {
  /** Из ЛЮБОЙ точки записи ключа реестра: debounce-пуш, схлопывает серию в один вызов. */
  notifyPrefsChanged: () => void;
  /** Один раз при старте с uiPrefs из GET /api/settings (server wins / миграция). */
  syncFromServer: (prefs: UiPrefsPatch | null | undefined) => void;
  /** Новая сессия (другой пользователь): снять отложенный пуш и закрыть пуш до ответа сервера. */
  reset: () => void;
}

export function createUiPrefsSync(opts: UiPrefsSyncOptions): UiPrefsSync {
  const { api, storage = localPrefStorage, debounceMs = 1500 } = opts;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let synced = !opts.requireInitialSync;

  function cancel(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function pushNow(): void {
    timer = null;
    try {
      void api
        .updateSettings({ uiPrefs: collectPrefs(storage) })
        .then(() => storage.setItem(MIGRATED_KEY, '1'))
        .catch((e) => console.error('updateSettings(uiPrefs) failed', e));
    } catch (e) {
      // fire-and-forget, как trackEvent — синхронизация не мешает UI
      console.error('updateSettings(uiPrefs) threw', e);
    }
  }

  return {
    notifyPrefsChanged() {
      if (!synced) return;
      cancel();
      timer = setTimeout(pushNow, debounceMs);
    },
    // Пустой ответ И устройство ещё не мигрировало → локальные ключи есть —
    // пушим немедленно (миграцию отметит успех пуша); пусто локально —
    // отмечаем сразу. Иначе (реальные данные ИЛИ уже мигрировали) — server
    // wins: применяем и НЕ пушим обратно только что применённое.
    syncFromServer(prefs) {
      cancel();
      synced = true;
      const server = prefs ?? {};
      const migrated = storage.getItem(MIGRATED_KEY) === '1';
      if (!migrated && Object.keys(server).length === 0) {
        if (Object.keys(collectPrefs(storage)).length > 0) pushNow();
        else storage.setItem(MIGRATED_KEY, '1');
        return;
      }
      applyServerPrefs(server, storage);
      storage.setItem(MIGRATED_KEY, '1');
    },
    reset() {
      cancel();
      synced = !opts.requireInitialSync;
    },
  };
}
