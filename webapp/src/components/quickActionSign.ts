// Знак быстрого действия в палитре ⌘K (CommandPalette.tsx) — знак его сущности ENTITY_LOOK.
import type { SignKey } from '../../../shared/src/theme/entityLook';
import type { QuickActionId } from '../../../shared/src/quickActions/quickActions';

/** Знак быстрого действия — знак его сущности (QUICK_ACTION_ENTITY → ENTITY_LOOK): одна сущность — один знак.
 *  Литералы, а не рантайм-импорт entityLook: он перекраивал чанки — CSS упражнений вставал раньше index.css
 *  (check-css-link-order, как у PaperAlert). Сверка с таблицей — CommandPaletteList.test.tsx. */
export const QUICK_ACTION_SIGN: Record<QuickActionId, SignKey> = {
  case: 'ribbon', tracker: 'strokes', diary_schema: 'layers', diary_mode: 'cluster', diary_gratitude: 'pebbles',
  breathing: 'breath', grounding: 'grounded', stop: 'pause', belief_check: 'scales', phrase_check: 'looming',
  flashcard: 'heart', safe_place: 'haven', letter_to_self: 'sheets', warm_words: 'heart', childhood_wheel: 'wheel',
  tasks: 'check', practices: 'leaf', plans: 'check',
};
