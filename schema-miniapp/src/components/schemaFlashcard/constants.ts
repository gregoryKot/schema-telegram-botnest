// Единственная копия контента — в shared (правило №3 CLAUDE.md).
export type {
  FlashcardEntry,
  ModeData,
  NeedData,
  Step,
} from '../../../../shared/src/flashcard/types';
export {
  STORAGE_KEY,
  buildModes,
  NEEDS,
  STEPS,
  loadLocal,
} from '../../../../shared/src/flashcard/modes';
