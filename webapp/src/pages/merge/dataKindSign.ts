// Знак строки «что переедет» на /link и /account/merge (docs/design/APP_2026-11.md, «Меню, ⌘K,
// объединение»: `dataKindSign`): таблица переноса → знак сущности. Источник правды — DATA_KIND_ENTITY
// и ENTITY_LOOK в shared/src/theme; здесь — та же таблица литералами, как outcomeLook.ts: обе страницы
// в главном чанке, а рантайм-импорт entityLook в главный поток перекраивал чанки и порядок CSS
// (check-css-link-order). Сверка с shared — dataKindSign.test.ts.
import type { SignKey } from '../../../../shared/src/theme/entityLook';

export const DATA_KIND_SIGN_LIT: Readonly<Record<string, SignKey>> = {
  Rating: 'strokes',
  Note: 'pebbles', SchemaDiaryEntry: 'pebbles', ModeDiaryEntry: 'pebbles', GratitudeDiaryEntry: 'pebbles', DiaryDraft: 'pebbles',
  UserSchemaNote: 'layers', YsqProgress: 'layers', YsqResult: 'layers', YsqResultHistory: 'layers',
  UserModeNote: 'cluster',
  UserTask: 'check', PracticePlan: 'check',
  AppActivity: 'sheets', UserLetter: 'sheets',
  TherapyRelation: 'talk', Booking: 'talk',
  ChildhoodRating: 'wheel', PracticeSession: 'breath', ScheduledNotification: 'beads',
  UserBeliefCheck: 'scales', UserFlashcard: 'heart', UserPractice: 'leaf', UserSafePlace: 'haven',
  Pair: 'need_attachment',
};

/** Знак таблицы переноса; незнакомая таблица (сервер новее сайта) — null: строка без знака, а не чужой. */
export function dataKindSign(table: string): SignKey | null {
  return Object.hasOwn(DATA_KIND_SIGN_LIT, table) ? DATA_KIND_SIGN_LIT[table] : null;
}
