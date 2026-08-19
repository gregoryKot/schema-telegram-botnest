// Блоки экранов «Профиль»/«Паттерны»/«Сегодня», которые можно скрыть/
// переставить (meta.block для screen_block_toggle/screen_block_move), и сами
// настраиваемые экраны (meta.screen для
// screen_customize_open/screen_block_toggle/screen_block_move). Парный
// реестр на фронте — SCREEN_BLOCK_IDS в
// schema-miniapp/src/utils/screenBlocks.ts (по id на строке, как
// QUICK_ACTION_IDS); сверку держит
// src/security/screen-blocks-sync.invariants.spec.ts. Вынесено из
// analytics.constants.ts отдельным файлом (правило №10 — тот файл держим
// минимальным). via переиспользует CUSTOMIZE_ENTRY_POINTS — отдельного
// списка нет.
//
// focus/phrase/secondary/therapist_banner — блоки «Сегодня» (streak уже был
// в списке). У «Сегодня» нет screen_block_toggle (видимость там регулируют
// частные today_*_hidden-ключи, см. ui-prefs.sanitize.ts) — только
// screen_block_move (перестановка, ключ screen_order_today).
//
// portrait/my_schemas/my_modes/warm_words — блоки редизайна вкладки «Я»
// (identity-слой поверх статистики профиля, 2026-08): «Мой портрет» (домены
// схем/режимов), списки «Мои схемы»/«Мои режимы», превью «Тёплых слов».
export const SCREEN_BLOCK_IDS = [
  'journey',
  'streak',
  'heatmap',
  'achievements',
  'insights',
  'heroes',
  'ysq_status',
  'focus',
  'phrase',
  'secondary',
  'therapist_banner',
  'portrait',
  'my_schemas',
  'my_modes',
  'warm_words',
] as const;
export type ScreenBlockId = (typeof SCREEN_BLOCK_IDS)[number];

// Экраны, у которых есть «Настроить экран» (шестерёнка/долгое нажатие).
export const CUSTOMIZABLE_SCREENS = ['profile', 'patterns', 'today'] as const;
export type CustomizableScreen = (typeof CUSTOMIZABLE_SCREENS)[number];
