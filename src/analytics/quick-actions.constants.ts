// Идентификаторы пунктов универсального меню «плюс» (meta.action для
// plus_action/quick_action_toggle). Парный реестр — на фронте та же строка в
// строку копия живёт в schema-miniapp/src/utils/quickActions.ts (константа
// QUICK_ACTION_IDS, по одному id в строке); сверку держит
// src/security/quick-actions-sync.invariants.spec.ts. Вынесено из
// analytics.constants.ts отдельным файлом (правило №10 — тот файл держим
// минимальным).
//   tracker          — трекер потребностей;
//   diary_schema     — дневник схем;
//   diary_mode       — дневник режимов;
//   diary_gratitude  — дневник благодарности;
//   breathing        — дыхание 4-4-6;
//   grounding        — заземление 5-4-3-2-1;
//   stop             — техника «Стоп»;
//   belief_check     — проверка убеждений;
//   phrase_check     — «Критик или забота?»;
//   flashcard        — «Схема включилась» (карточка-упражнение);
//   safe_place       — безопасное место;
//   letter_to_self   — письмо себе;
//   warm_words       — тёплые слова;
//   childhood_wheel  — колесо детства;
//   tasks            — мои цели;
//   practices        — практики;
//   plans            — планы.
export const QUICK_ACTION_IDS = [
  'tracker',
  'diary_schema',
  'diary_mode',
  'diary_gratitude',
  'breathing',
  'grounding',
  'stop',
  'belief_check',
  'phrase_check',
  'flashcard',
  'safe_place',
  'letter_to_self',
  'warm_words',
  'childhood_wheel',
  'tasks',
  'practices',
  'plans',
] as const;
export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

// Где показан пункт (meta.surface для quick_action_toggle): 'plus' — само
// меню-лист «плюс», 'tools' — настройка меню из вкладки инструментов.
export const QUICK_ACTION_SURFACES = ['plus', 'tools'] as const;
export type QuickActionSurface = (typeof QUICK_ACTION_SURFACES)[number];

// Направление сдвига пункта при переупорядочивании (meta.dir для
// quick_action_move).
export const QUICK_ACTION_MOVE_DIRS = ['up', 'down'] as const;
export type QuickActionMoveDir = (typeof QUICK_ACTION_MOVE_DIRS)[number];
