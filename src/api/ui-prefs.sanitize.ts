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
] as const;
export type SyncedPrefKey = (typeof SYNCED_PREF_KEYS)[number];

const MAX_VALUE_LEN = 2000;

const BOOLEAN_FLAG_KEYS: ReadonlySet<SyncedPrefKey> = new Set([
  'today_streak_hidden',
  'today_phrase_hidden',
  'today_secondary_hidden',
  'today_therapist_banner_hidden',
]);

const ID_ARRAY_KEYS: Partial<
  Record<SyncedPrefKey, { allow: ReadonlySet<string>; maxLen: number }>
> = {
  quick_actions_hidden_plus: { allow: QUICK_ACTION_ID_SET, maxLen: 32 },
  quick_actions_order_plus: { allow: QUICK_ACTION_ID_SET, maxLen: 32 },
  quick_actions_hidden_tools: { allow: QUICK_ACTION_ID_SET, maxLen: 32 },
  quick_actions_order_tools: { allow: QUICK_ACTION_ID_SET, maxLen: 32 },
  screen_hidden_profile: { allow: SCREEN_BLOCK_ID_SET, maxLen: 16 },
  screen_hidden_patterns: { allow: SCREEN_BLOCK_ID_SET, maxLen: 16 },
};

// Значение — сериализованный JSON-массив id, элементы ⊆ allow, длина ≤ maxLen.
function isValidIdArray(
  value: string,
  allow: ReadonlySet<string>,
  maxLen: number,
): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  return (
    Array.isArray(parsed) &&
    parsed.length <= maxLen &&
    parsed.every((el) => typeof el === 'string' && allow.has(el))
  );
}

function isValidValue(key: SyncedPrefKey, value: string): boolean {
  if (key === 'today_focus_practice')
    return TODAY_FOCUS_PRACTICE_SET.has(value);
  if (BOOLEAN_FLAG_KEYS.has(key)) return value === '1' || value === '0';
  const arraySpec = ID_ARRAY_KEYS[key];
  return arraySpec
    ? isValidIdArray(value, arraySpec.allow, arraySpec.maxLen)
    : false;
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
    if (!isValidValue(key, value)) continue;
    out[key] = value;
  }
  return out;
}
