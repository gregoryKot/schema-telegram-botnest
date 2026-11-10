// Что → сущность ENTITY_LOOK (entityLook.ts): тип записи «Моего пути», быстрое действие ⌘K
// и «плюса», задание по маршруту, таблица переноса данных при объединении входов. Вид
// берётся у сущности — свой знак здесь не выбирают (одна сущность — один знак).
// Достижения и исходы служебных страниц — не сущности продукта, у них своя таблица вида
// (значок достижения берёт вид сущности своего знака — сверка в entityLook.test.ts).
// Сверка полноты: типы Record ниже (journey, быстрые действия, маршрут задания), остальное —
// entityLook.test.ts и webapp/src/components/art/SignArt.test.tsx (достижения, таблицы переноса).
// Импорт из entityLook.ts — только типы: тот реэкспортирует этот файл.
import type { JourneyItemType } from '../journey/journeyMeta';
import type { QuickActionId } from '../quickActions/quickActions';
import type { TaskExercise, TaskRoute } from '../tasks/taskRoute';
import type { EntityId, Look } from './entityLook';

/** Тип записи «Моего пути» → сущность (знак строки вместо эмодзи journeyMeta). */
export const JOURNEY_ENTITY: Record<JourneyItemType, EntityId> = {
  tracker_day: 'tracker',
  note: 'note',
  schema_diary: 'diary_schema',
  mode_diary: 'diary_mode',
  gratitude: 'gratitude',
  practice: 'nourish',
  plan_done: 'plan',
  ysq: 'ysq',
  belief_check: 'belief_check',
  letter: 'letter',
  flashcard: 'sos',
  safe_place: 'safe_place',
  schema_note: 'schema_card',
  mode_note: 'mode_card',
  breathing: 'breathing',
  grounding: 'grounding',
  stop: 'stop',
};

/** Сущность записи пути; незнакомый тип — null (без выдуманного знака). */
export const journeyEntity = (type: string): EntityId | null =>
  Object.hasOwn(JOURNEY_ENTITY, type)
    ? JOURNEY_ENTITY[type as JourneyItemType]
    : null;

/** Быстрое действие (⌘K, «плюс», инструменты) → сущность. */
export const QUICK_ACTION_ENTITY: Record<QuickActionId, EntityId> = {
  case: 'case',
  tracker: 'tracker',
  diary_schema: 'diary_schema',
  diary_mode: 'diary_mode',
  diary_gratitude: 'gratitude',
  breathing: 'breathing',
  grounding: 'grounding',
  stop: 'stop',
  belief_check: 'belief_check',
  phrase_check: 'phrase_check',
  flashcard: 'sos',
  safe_place: 'safe_place',
  letter_to_self: 'letter',
  warm_words: 'warm_words',
  childhood_wheel: 'childhood_wheel',
  tasks: 'task',
  practices: 'nourish',
  plans: 'plan',
};

const TASK_EXERCISE_ENTITY: Record<TaskExercise, EntityId> = {
  belief_check: 'belief_check',
  letter_to_self: 'letter',
  safe_place: 'safe_place',
  flashcard: 'sos',
};

const TASK_ROUTE_ENTITY: Record<
  Exclude<TaskRoute['kind'], 'exercise'>,
  EntityId
> = {
  diary: 'diary',
  tracker: 'tracker',
  childhood_wheel: 'childhood_wheel',
  schema: 'schema_card',
  mode: 'mode_card',
  ysq: 'ysq',
  self: 'task',
  none: 'task',
};

/** Знак строки задания — по тому, куда оно ведёт (taskRoute): упражнение — его сущность, своё — «задание». */
export function taskRouteEntity(route: TaskRoute): EntityId {
  return route.kind === 'exercise'
    ? TASK_EXERCISE_ENTITY[route.exercise]
    : TASK_ROUTE_ENTITY[route.kind];
}

/**
 * Таблица переноса данных (TABLE_LABELS, webapp/src/utils/mergeLabels.ts) → сущность строки «что
 * переедет» (APP_2026-11.md, `dataKindSign`): трекер — Strokes, дневники и заметки — Pebbles,
 * схемы и YSQ — Layers, режимы — Cluster, задания — Check, «Мой путь» — Sheets, терапевт — Talk;
 * упражнения и практики — своя сущность.
 */
export const DATA_KIND_ENTITY: Record<string, EntityId> = {
  AppActivity: 'journey',
  Booking: 'therapist',
  ChildhoodRating: 'childhood_wheel',
  DiaryDraft: 'diary',
  GratitudeDiaryEntry: 'diary',
  ModeDiaryEntry: 'diary',
  Note: 'diary',
  Pair: 'pair',
  PracticePlan: 'plan',
  PracticeSession: 'breathing',
  Rating: 'tracker',
  ScheduledNotification: 'settings',
  SchemaDiaryEntry: 'diary',
  TherapyRelation: 'therapist',
  UserBeliefCheck: 'belief_check',
  UserFlashcard: 'sos',
  UserLetter: 'letter',
  UserModeNote: 'modes',
  UserPractice: 'nourish',
  UserSafePlace: 'safe_place',
  UserSchemaNote: 'schemas',
  UserTask: 'task',
  YsqProgress: 'schemas',
  YsqResult: 'schemas',
  YsqResultHistory: 'schemas',
};

/** Сущность таблицы переноса; незнакомая таблица — null (строка без знака). */
export const dataKindEntity = (table: string): EntityId | null =>
  Object.hasOwn(DATA_KIND_ENTITY, table) ? DATA_KIND_ENTITY[table] : null;

/**
 * Значки достижений (ACHIEVEMENT_META, webapp/src/sections/profile/profileMeta.ts): знак по
 * смыслу, оттенок — бумага сущности этого знака (APP_2026-11.md). Первый шаг — камешек
 * дневника; серии — пять полосок трекера (плотнее к длинной серии — вариантом мотива на
 * экране); дни всего — листы «Моего пути»; хороший день — лист профиля; баланс — колесо;
 * возвращение — ладони тёплых слов (ChildCare); рост — полоска автономии стоит прямо; партнёр — привязанность.
 */
export const ACHIEVEMENT_LOOK: Record<string, Look> = {
  first_day: { hue: 45, sign: 'pebbles' },
  streak_3: { hue: 70, sign: 'strokes' },
  streak_7: { hue: 70, sign: 'strokes' },
  streak_14: { hue: 70, sign: 'strokes' },
  streak_30: { hue: 70, sign: 'strokes' },
  streak_100: { hue: 70, sign: 'strokes' },
  total_10: { hue: 240, sign: 'sheets' },
  total_50: { hue: 240, sign: 'sheets' },
  high_day: { hue: 195, sign: 'leaf' },
  all_above7: { hue: 45, sign: 'wheel' },
  comeback: { hue: 70, sign: 'child_care' },
  growth: { hue: 70, sign: 'need_autonomy' },
  pair_connected: { hue: 28, sign: 'need_attachment' },
};

/** Вид значка достижения; незнакомое — null. */
export const achievementLook = (id: string): Look | null =>
  Object.hasOwn(ACHIEVEMENT_LOOK, id) ? ACHIEVEMENT_LOOK[id] : null;

export type OutcomeId = 'done' | 'limit' | 'wait' | 'our_side' | 'updated';

/** Исход служебной страницы (PaperOutcome): готово, граница удержана (2FA, отказ), подожди или
 *  устарело (429, ссылка устарела, 404), сбой на нашей стороне, обновилось. */
export const OUTCOME_LOOK: Record<OutcomeId, Look> = {
  done: { hue: 135, sign: 'check' },
  limit: { hue: 240, sign: 'limits' },
  wait: { hue: 70, sign: 'cup' },
  our_side: { hue: 45, sign: 'breath' },
  updated: { hue: 135, sign: 'leaf' },
};
