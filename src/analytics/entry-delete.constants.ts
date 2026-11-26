// Тип удаляемой записи для события entry_deleted (meta.type). Отдельным
// файлом — analytics.constants.ts уже сверх лимита размера (правило №10),
// тот же приём, что у share-card-kinds.constants.ts.
//   belief_check — проверка убеждения (архив «Мой путь»);
//   letter       — письмо себе;
//   flashcard    — кризисная карточка (schema flashcard);
//   phrase_check — разбор фразы («Прошлые разборы», PhraseHistoryCard);
//   diary        — запись дневника схем/режимов/благодарности («Записи»,
//                  экран паттерна; shared/src/diary/diaryDelete.ts).
// Первые три удаляются из «Моего пути» (JourneyDeletableType), остальные — на
// своих экранах. Парный тип фронта — EntryDeleteType в
// shared/src/share/analytics.ts, сверка — analytics-sync.invariants.spec.ts.
export const ENTRY_DELETE_TYPES = [
  'belief_check',
  'letter',
  'flashcard',
  'phrase_check',
  'diary',
] as const;
export type EntryDeleteType = (typeof ENTRY_DELETE_TYPES)[number];
