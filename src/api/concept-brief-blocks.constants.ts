// Блоки экрана «Главное» (uiPrefs-ключ concept_brief_blocks) — копия id реестра BRIEF_BLOCKS
// (shared/src/therapy/conceptBrief/conceptBrief.ts): rootDir бэкенда не пускает в shared, сверка — ui-prefs-sync.invariants.spec.ts.
export const CONCEPT_BRIEF_BLOCK_IDS = [
  'schemas',
  'modes',
  'needs',
  'cycle',
  'goals',
  'problems',
  'triggers',
  'coping',
  'early',
] as const;
