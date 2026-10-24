// Тип удаляемой записи для события entry_deleted (meta.type). Отдельным
// файлом — analytics.constants.ts уже сверх лимита размера (правило №10),
// тот же приём, что у share-card-kinds.constants.ts.
//   belief_check — проверка убеждения (архив «Мой путь»);
//   letter       — письмо себе;
//   flashcard    — кризисная карточка (schema flashcard).
export const ENTRY_DELETE_TYPES = [
  'belief_check',
  'letter',
  'flashcard',
] as const;
export type EntryDeleteType = (typeof ENTRY_DELETE_TYPES)[number];
