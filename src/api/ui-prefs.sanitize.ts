import {
  QUICK_ACTION_ID_SET,
  SCREEN_BLOCK_ID_SET,
  TODAY_FOCUS_PRACTICE_SET,
} from './dto/analytics.dto';

// Реестр ключей кастомизации мини-аппа, синхронизируемых с сервером
// (User.uiPrefs). Парная константа на фронте — SYNCED_PREF_KEYS в
// schema-miniapp/src/utils/uiPrefsSync.ts (по одному ключу на строку);
// сверку держит src/security/ui-prefs-sync.invariants.spec.ts (правило №4 —
// денормализованный/дублированный реестр под тестом-сверкой).
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
] as const;
export type SyncedPrefKey = (typeof SYNCED_PREF_KEYS)[number];

const MAX_VALUE_LEN = 2000;

const BOOLEAN_FLAG_KEYS: ReadonlySet<SyncedPrefKey> = new Set([
  'today_streak_hidden',
  'today_phrase_hidden',
  'today_secondary_hidden',
  'today_therapist_banner_hidden',
]);

// mode: 'strict' — весь ключ отбрасывается, если хоть один элемент вне allow
// (текущее поведение quick actions — их id ничего в этом PR не убирал).
// mode: 'filter' — элементы вне allow тихо выкидываются, известные остаются
// (screen_*: правило CLAUDE.md «удаление блока не должно ронять устройство,
// уже сохранившее старый порядок с этим id» — см.
// src/api/ui-prefs.sanitize.spec.ts, кейс «частично устаревший массив»).
type ArrayMode = 'strict' | 'filter';
interface ArraySpec {
  allow: ReadonlySet<string>;
  maxLen: number;
  mode: ArrayMode;
}
function arraySpecsFor(
  keys: readonly SyncedPrefKey[],
  allow: ReadonlySet<string>,
  maxLen: number,
  mode: ArrayMode,
): [SyncedPrefKey, ArraySpec][] {
  return keys.map((key) => [key, { allow, maxLen, mode }]);
}
const ID_ARRAY_KEYS: Partial<Record<SyncedPrefKey, ArraySpec>> =
  Object.fromEntries([
    ...arraySpecsFor(
      [
        'quick_actions_hidden_plus',
        'quick_actions_order_plus',
        'quick_actions_hidden_tools',
        'quick_actions_order_tools',
      ],
      QUICK_ACTION_ID_SET,
      32,
      'strict',
    ),
    ...arraySpecsFor(
      [
        'screen_hidden_profile',
        'screen_hidden_patterns',
        'screen_order_profile',
        'screen_order_patterns',
        'screen_order_today',
      ],
      SCREEN_BLOCK_ID_SET,
      16,
      'filter',
    ),
  ]);

// Разбор JSON-массива id: не JSON/не массив/сверх maxLen/не-строковый
// элемент — null (структурно невалидно, отбрасываем ключ целиком).
// Иначе — элементы, оставшиеся ПОСЛЕ фильтра по allow, плюс флаг «что-то
// выбросили» (нужен строгому режиму quick actions — там любой чужой id всё
// ещё валит ключ целиком, см. mode выше).
function filterIdArray(
  value: string,
  allow: ReadonlySet<string>,
  maxLen: number,
): { ids: string[]; droppedAny: boolean } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > maxLen) return null;
  if (!parsed.every((el): el is string => typeof el === 'string')) return null;
  const ids = parsed.filter((id) => allow.has(id));
  return { ids, droppedAny: ids.length !== parsed.length };
}

/**
 * Санитизация User.uiPrefs — «всё или ничего» ПО КЛЮЧУ: известный ключ с
 * валидным значением проходит, неизвестный ключ или невалидное значение
 * отбрасывается (не весь объект). Сервер хранит объект целиком — вызывающая
 * сторона (SettingsController) заменяет им User.uiPrefs полностью.
 * `raw`, не являющийся объектом (в т.ч. массив/null/примитив), — сигнал не
 * трогать сохранённые настройки: возвращаем undefined.
 */
export function sanitizeUiPrefs(
  raw: unknown,
): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return undefined;
  const input = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of SYNCED_PREF_KEYS) {
    const value = input[key];
    if (typeof value !== 'string' || value.length > MAX_VALUE_LEN) continue;
    if (key === 'today_focus_practice') {
      if (TODAY_FOCUS_PRACTICE_SET.has(value)) out[key] = value;
      continue;
    }
    if (BOOLEAN_FLAG_KEYS.has(key)) {
      if (value === '1' || value === '0') out[key] = value;
      continue;
    }
    const arraySpec = ID_ARRAY_KEYS[key];
    if (!arraySpec) continue;
    const result = filterIdArray(value, arraySpec.allow, arraySpec.maxLen);
    if (!result) continue;
    if (arraySpec.mode === 'strict' && result.droppedAny) continue;
    out[key] = JSON.stringify(result.ids);
  }
  return out;
}
