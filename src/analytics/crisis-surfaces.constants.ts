// Экран, где показалась кризисная карточка (meta.surface для crisis_*): только
// перечислимый источник, без свободного текста (правило №7). Файл — правило №10.
//   schema       — заметка к схеме;
//   mode         — заметка к режиму;
//   gratitude    — практика благодарности;
//   note         — дневниковая заметка;
//   practice     — упражнение-практика;
//   letter       — письмо себе (упражнение-письмо);
//   safe_place   — безопасное место;
//   weekly       — вопрос недели;
//   belief_check — проверка убеждения;
//   flashcard    — карточки-упражнения (schema flashcard);
//   task         — своё задание/цель (TaskCreateSheet, тип custom);
//   phrase_check — «Критик или забота?» (PhraseCheck, RewriteStep, HistoryCard);
//   booking      — поле «Запрос» и экран «Заявка отправлена» на визитке.
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
  'task',
  'phrase_check',
  'booking',
] as const;

export type CrisisSurface = (typeof CRISIS_SURFACES)[number];
