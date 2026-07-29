// Экран, на котором показалась кризисная карточка (meta.surface для
// crisis_*). Без свободного текста — только перечислимый источник (правило №7
// CLAUDE.md). Вынесено из analytics.constants.ts отдельным файлом (правило
// №10 — тот файл держим ≤201 строки).
//   schema       — заметка к схеме;
//   mode         — заметка к режиму;
//   gratitude    — практика благодарности;
//   note         — дневниковая заметка;
//   practice     — упражнение-практика;
//   letter       — письмо себе (упражнение-письмо);
//   safe_place   — безопасное место;
//   weekly       — вопрос недели;
//   belief_check — проверка убеждения;
//   flashcard    — карточки-упражнения (schema flashcard).
export const CRISIS_SURFACES = [
  'schema',
  'mode',
  'gratitude',
  'note',
  'practice',
  'letter',
  'safe_place',
  'weekly',
  'belief_check',
  'flashcard',
] as const;
export type CrisisSurface = (typeof CRISIS_SURFACES)[number];
