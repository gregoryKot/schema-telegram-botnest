// Вид сущности — одна таблица на сайт, canvas шаринга и кабинет терапевта (редизайн
// приложения 2026-11, docs/design/PAPER_2026-11.md, «Мотив → смысл»). Одна сущность —
// один оттенок бумаги, один знак и одна сцена «готово»: герой потока, плитка на главной,
// строка ленты, лист «готово», строка задания, строка «Моего пути» и карточка шаринга
// берут вид отсюда, а не выбирают на месте.
// Оттенки бумаги и ключи знаков — signKeys.ts (реэкспорт здесь): ключи — строки, shared не
// импортирует webapp; рисунок по ключу отдаёт webapp/src/components/art/SignArt.tsx.
// Схема, режим и потребность — не строки этой таблицы: их вид задают домен, группа и сама
// потребность (DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE в entityHue.ts) — функции ниже.
// Таблицы «что → сущность» (тип записи пути, быстрое действие, задание, таблица переноса
// данных), достижения и исходы служебных страниц — entityLookMaps.ts, реэкспорт внизу.
import type { NeedId } from '../needs/types';
import { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE } from './entityHue';
import { PAPER_HUE, SIGN_KEYS, type PaperHue, type SignKey } from './signKeys';

export { PAPER_HUE, SIGN_KEYS };
export type { PaperHue, SignKey };

/** Сцена «готово» (art/AppScenes*.tsx): знак + проросший лист, камешек лёг, дыхание улеглось, лист дня в серии. */
export const DONE_SCENES = [
  'sprout',
  'pebble_laid',
  'breath_rest',
  'check_in',
] as const;
export type DoneScene = (typeof DONE_SCENES)[number];

/** Вид листа заготовок (EntitySheet, ExScreen look, SsHead look, PaperAlert, DoneSheet): бумага
 *  палитры и знак; без знака лист стоит без картинки или со своей сценой героя. Один тип на все
 *  заготовки — вид из партии `{ hue, sign? }` подходит каждой. */
export interface SheetLook {
  hue: PaperHue;
  sign?: SignKey;
}
/** Тот же вид, где знак и есть содержание (исход PaperOutcome, достижение, строка задания). */
export interface Look extends SheetLook {
  sign: SignKey;
}
export interface EntityLook extends Look {
  done: DoneScene | null;
}

/**
 * Таблица словами — docs/design/APP_2026-11.md, «ENTITY_LOOK словами» (правка вида — строка там
 * и здесь одним PR). Опоры — оттенки главной: трекер — солома + Strokes, «Что случилось» —
 * шалфей + Ribbon, быстрая запись — персик + Pebbles. Схемы вообще — глина 28 + Layers, режимы
 * вообще — небо 240 + Cluster (DIARY_HUE); дневник схем, карточка схемы и YSQ, дневник и
 * карточка режима — та же семья вида (LOOK_FAMILY), в шагах карточки — бумага домена или
 * группы (domainLook, modeGroupLook). «Мне плохо» — бережная роза 25 + Heart. Соседние плитки
 * (главная, практики, бенто библиотеки упражнений) — не ближе 40° по кругу оттенков.
 * Оттенки — числами PAPER_HUE (роза 25, глина 28, персик 45, солома 70, шалфей 135, мох 145,
 * бирюза 195, небо 240, сирень 290, слива 310), записи — литералы: неиспользуемая таблица
 * выпадает из главного чанка при сборке (вызовы и чтения свойств сборщик бы оставил).
 * `done` — сцена «готово» (по умолчанию Sprout); null — у сущности нет листа «готово».
 */
export const ENTITY_LOOK = {
  tracker: { hue: 70, sign: 'strokes', done: 'check_in' },
  note: { hue: 70, sign: 'pebbles', done: null },
  case: { hue: 135, sign: 'ribbon', done: 'sprout' },
  diary: { hue: 45, sign: 'pebbles', done: 'pebble_laid' },
  gratitude: { hue: 195, sign: 'pebbles', done: 'pebble_laid' },
  schemas: { hue: 28, sign: 'layers', done: null },
  diary_schema: { hue: 28, sign: 'layers', done: 'sprout' },
  schema_card: { hue: 28, sign: 'layers', done: 'sprout' },
  ysq: { hue: 28, sign: 'layers', done: null },
  modes: { hue: 240, sign: 'cluster', done: null },
  diary_mode: { hue: 240, sign: 'cluster', done: 'sprout' },
  mode_card: { hue: 240, sign: 'cluster', done: 'sprout' },
  breathing: { hue: 45, sign: 'breath', done: 'breath_rest' },
  grounding: { hue: 135, sign: 'grounded', done: 'sprout' },
  stop: { hue: 70, sign: 'pause', done: 'sprout' },
  sos: { hue: 25, sign: 'heart', done: 'sprout' },
  belief_check: { hue: 70, sign: 'scales', done: 'sprout' },
  letter: { hue: 290, sign: 'sheets', done: 'sprout' },
  safe_place: { hue: 135, sign: 'haven', done: 'sprout' },
  childhood_wheel: { hue: 45, sign: 'wheel', done: 'sprout' },
  warm_words: { hue: 45, sign: 'heart', done: 'sprout' },
  phrase_check: { hue: 310, sign: 'looming', done: 'sprout' },
  nourish: { hue: 145, sign: 'leaf', done: null },
  plan: { hue: 135, sign: 'check', done: 'sprout' },
  task: { hue: 240, sign: 'check', done: 'sprout' },
  profile: { hue: 195, sign: 'leaf', done: null },
  journey: { hue: 240, sign: 'sheets', done: null },
  portrait: { hue: 135, sign: 'strokes', done: null },
  therapist: { hue: 240, sign: 'talk', done: null },
  pair: { hue: 28, sign: 'need_attachment', done: null },
  settings: { hue: 70, sign: 'beads', done: null },
} as const satisfies Record<string, EntityLook>;
export type EntityId = keyof typeof ENTITY_LOOK;

/** Семьи вида: сущность выглядит как глава семьи — схемы вообще и режимы вообще. Других
 *  совпадений «оттенок + знак» в таблице нет (entityLook.test.ts). */
export const LOOK_FAMILY: Partial<Record<EntityId, EntityId>> = {
  diary_schema: 'schemas',
  schema_card: 'schemas',
  ysq: 'schemas',
  diary_mode: 'modes',
  mode_card: 'modes',
};

/** Знак группы режимов — круги: что с этой частью делают в терапии (рисунки — GuideSignsModes.tsx). */
export const MODE_GROUP_SIGN = {
  child: 'child_care',
  coping_surrender: 'yield',
  coping_avoidance: 'shelter',
  coping_overcompensation: 'shield',
  critic: 'looming',
  healthy: 'together',
} as const satisfies Record<string, SignKey>;

const isPaperHue = (h: number | undefined): h is PaperHue =>
  h !== undefined && (Object.values(PAPER_HUE) as number[]).includes(h);

/** Вид режима по группе: бумага группы и её знак; без группы (свой режим) — общий знак режимов. */
export function modeGroupLook(groupId: string | undefined): Look {
  const hue = groupId ? MODE_GROUP_HUE[groupId] : undefined;
  const sign =
    groupId && Object.hasOwn(MODE_GROUP_SIGN, groupId)
      ? MODE_GROUP_SIGN[groupId as keyof typeof MODE_GROUP_SIGN]
      : 'cluster';
  return { hue: isPaperHue(hue) ? hue : ENTITY_LOOK.modes.hue, sign };
}

/** Вид схемы по домену; неизвестный домен — null (без выдуманного знака). */
export function domainLook(domainId: string): Look | null {
  const hue = DOMAIN_HUE[domainId];
  const sign = `domain_${domainId}`;
  return isPaperHue(hue) && (SIGN_KEYS as readonly string[]).includes(sign)
    ? { hue, sign: sign as SignKey }
    : null;
}

/** Вид потребности: её бумага и её знак. */
export function needLook(id: NeedId): Look {
  return { hue: NEED_HUE[id] as PaperHue, sign: `need_${id}` as const };
}

export {
  JOURNEY_ENTITY,
  journeyEntity,
  QUICK_ACTION_ENTITY,
  taskRouteEntity,
  DATA_KIND_ENTITY,
  dataKindEntity,
  ACHIEVEMENT_LOOK,
  achievementLook,
  OUTCOME_LOOK,
} from './entityLookMaps';
export type { OutcomeId } from './entityLookMaps';
