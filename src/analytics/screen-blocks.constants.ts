// Блоки экранов «Профиль»/«Паттерны», которые можно скрыть (meta.block для
// screen_block_toggle), и сами настраиваемые экраны (meta.screen для
// screen_customize_open/screen_block_toggle). Парный реестр на фронте —
// SCREEN_BLOCK_IDS в schema-miniapp/src/utils/screenBlocks.ts (по id на
// строке, как QUICK_ACTION_IDS); сверку держит
// src/security/screen-blocks-sync.invariants.spec.ts. Вынесено из
// analytics.constants.ts отдельным файлом (правило №10 — тот файл держим
// минимальным). via переиспользует CUSTOMIZE_ENTRY_POINTS — отдельного
// списка нет.
export const SCREEN_BLOCK_IDS = [
  'journey',
  'streak',
  'heatmap',
  'achievements',
  'insights',
  'heroes',
  'ysq_status',
] as const;
export type ScreenBlockId = (typeof SCREEN_BLOCK_IDS)[number];

// Экраны, у которых есть «Настроить экран» (шестерёнка/долгое нажатие).
export const CUSTOMIZABLE_SCREENS = ['profile', 'patterns'] as const;
export type CustomizableScreen = (typeof CUSTOMIZABLE_SCREENS)[number];
