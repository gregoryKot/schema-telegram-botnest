// Единый реестр быстрых действий (правило «одна механика — один компонент»):
// раньше 4 пункта кнопки «плюс» были зашиты прямо в FloatingPill, а часть тех
// же практик отдельно жила в HelpSection/ToolsList. QUICK_ACTION_IDS — парный
// реестр с бэкендом (src/analytics/quick-actions.constants.ts) — sync-спека
// грепает именно этот файл и блок ниже, держи по одному id на строке (так
// меньше merge-конфликтов, правило №13 CLAUDE.md).
//
// Сами определения (label/sub/группа/поверхности) и сборка групп «плюса» —
// в quickActionsRegistry.ts (этот файл упирается в свой бейслайн размера,
// правило №10) — реэкспортированы ниже, чтобы у потребителей остался один
// путь импорта: 'utils/quickActions'.
export const QUICK_ACTION_IDS = [
  'case',
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

export {
  QUICK_ACTIONS,
  getQuickAction,
  buildPlusActions,
  focusToQuickAction,
  type QuickAction,
  type QuickActionGroup,
  type QuickActionGroupId,
  type QuickActionDef,
} from './quickActionsRegistry';
