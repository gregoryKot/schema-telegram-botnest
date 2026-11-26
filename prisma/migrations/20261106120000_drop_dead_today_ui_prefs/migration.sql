-- Восемь ключей User.uiPrefs бывшей главной мини-аппа (решение владельца
-- 2026-11-04): мини-апп удалён, главная сайта их не читает, белый список
-- (SYNCED_PREF_KEYS) их больше не принимает, а в базе они ещё лежат у тех, кто
-- успел их сохранить. Выкидываем из jsonb.
-- Идемпотентно: оператор `- text[]` на отсутствующих ключах ничего не делает,
-- а условие `?|` не трогает строки без этих ключей; NULL в условие не попадает.
UPDATE "User"
SET "uiPrefs" = "uiPrefs" - ARRAY[
  'today_focus_practice',
  'today_streak_hidden',
  'today_phrase_hidden',
  'today_secondary_hidden',
  'today_therapist_banner_hidden',
  'screen_order_today',
  'quick_actions_hidden_plus',
  'quick_actions_order_plus'
]::text[]
WHERE "uiPrefs" ?| ARRAY[
  'today_focus_practice',
  'today_streak_hidden',
  'today_phrase_hidden',
  'today_secondary_hidden',
  'today_therapist_banner_hidden',
  'screen_order_today',
  'quick_actions_hidden_plus',
  'quick_actions_order_plus'
]::text[];
