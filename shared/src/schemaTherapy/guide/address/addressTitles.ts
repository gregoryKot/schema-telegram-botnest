import type {
  ModeGuide,
  PracticeNote,
  SchemaCoping,
  SchemaGuide,
  TechniqueGuide,
} from '../types';
import {
  GUIDE_CHANNELS,
  PLAN_RUBRIC_LABEL,
} from '../../../therapy/plan/planItem';
import type { GuideArticleKind } from './addressFormat';

// Заголовки разделов — как на листах справочника (webapp/src/components/therapist/guide/*Sheet.tsx).
// Тип требует заголовок у каждого поля статьи, кроме служебных: новое поле в types.ts без строки здесь — красный tsc.
type Meta =
  | 'schemaId'
  | 'modeId'
  | 'id'
  | 'name'
  | 'title'
  | 'sources'
  | 'approach'
  | 'group'
  | 'reparenting';
type Titles<A, Extra extends string = never> = Record<
  Exclude<keyof A, Meta> | Extra,
  string
>;

/** Служебные поля статьи (id, название, источники, группа) — не разделы; `reparenting` входит в «Как это звучит». */
export const META_FIELDS: ReadonlySet<string> = new Set<Meta>([
  'schemaId',
  'modeId',
  'id',
  'name',
  'title',
  'sources',
  'approach',
  'group',
  'reparenting',
]);

const COMMON = {
  voice: 'Как это звучит',
  more: 'Подробнее',
  stuck: 'Где застревают',
  techniques: PLAN_RUBRIC_LABEL.session,
  betweenSessions: PLAN_RUBRIC_LABEL.between,
};

export const COPING_TITLES: Record<keyof SchemaCoping, string> = {
  surrender: 'Капитуляция',
  avoidance: 'Избегание',
  overcompensation: 'Гиперкомпенсация',
};

const SCHEMA_TITLES: Titles<
  SchemaGuide,
  'domainNote' | `coping.${keyof SchemaCoping}`
> = {
  ...COMMON,
  essence: 'Суть',
  goal: 'Цель',
  need: 'Потребность',
  inSession: 'В кабинете',
  interventions: 'Что делать',
  coping: 'Копинг',
  'coping.surrender': COPING_TITLES.surrender,
  'coping.avoidance': COPING_TITLES.avoidance,
  'coping.overcompensation': COPING_TITLES.overcompensation,
  modeIds: 'Типичные режимы',
  domainNote: 'Общее для домена',
};

const MODE_TITLES: Titles<ModeGuide> = {
  ...COMMON,
  ...(Object.fromEntries(GUIDE_CHANNELS) as Record<
    (typeof GUIDE_CHANNELS)[number][0],
    string
  >),
  what: 'Что это',
  goal: 'Цель',
};

const TECHNIQUE_TITLES: Titles<TechniqueGuide> = {
  voice: COMMON.voice,
  more: COMMON.more,
  summary: 'Суть',
  when: 'Когда',
  pairsWith: 'В схема-терапии',
  steps: 'Как проводить',
  cautions: 'Когда не делать',
  evidence: 'Доказательность',
};

const NOTE_TITLES: Titles<PracticeNote> = {
  voice: COMMON.voice,
  more: COMMON.more,
  summary: 'Суть',
  points: 'Что делать',
};

/** Вид статьи → путь раздела → заголовок. */
export const SECTION_TITLES: Record<
  GuideArticleKind,
  Readonly<Record<string, string>>
> = {
  schema: SCHEMA_TITLES,
  mode: MODE_TITLES,
  technique: TECHNIQUE_TITLES,
  note: NOTE_TITLES,
};
