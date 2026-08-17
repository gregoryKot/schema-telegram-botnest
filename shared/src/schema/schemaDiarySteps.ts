/**
 * Шаги дневника схем — вопрос = отдельный экран визарда. Один источник для
 * обоих фронтов (правило №3): формулировки и примеры едины. Тон — тёплый
 * схема-терапевт; примеры конкретны (правило онбординга: «откуда и зачем»).
 * По образцу shared/src/mode/modeDiarySteps.ts.
 *
 * Обязательна только ситуация (trigger). Остальное можно пропустить — низкий
 * порог входа для СДВГ: можно сохранить в пару шагов или пройти глубже.
 *
 * `example` подставляется плейсхолдером — исчезает при вводе, не выдаётся за
 * сохранённые данные (не заглушка).
 *
 * Запись мультисхемная (несколько схем из разных доменов за один момент) —
 * единого «цвета выбранной схемы» нет, акцент дневника фиксирован
 * ('var(--accent-red)', задаётся в компонентах, не здесь).
 */

import type { EmotionEntry } from '../types';

type Tr = (ty: string, vy: string) => string;

/**
 * Payload сохранения записи дневника схем — состав полей идентичен на
 * обоих фронтах (жёсткий инвариант), поэтому объявлен один раз и
 * переиспользуется в Props miniapp/webapp SchemaEntrySheet (правило №3).
 */
export interface SchemaDiaryEntryInput {
  trigger: string;
  emotions: EmotionEntry[];
  thoughts?: string;
  bodyFeelings?: string;
  actualBehavior?: string;
  schemaIds: string[];
  schemaOrigin?: string;
  healthyView?: string;
  realProblems?: string;
  excessiveReactions?: string;
  healthyBehavior?: string;
}

/**
 * Текстовые поля дневника (без чипов «Чувства»/«Схемы» — те не текстовые,
 * их состав/порядок задают компоненты). `schemaOrigin` — текстовое поле, но
 * визуально живёт на одном экране с чипами схем (см. SCHEMA_DIARY_STEP_ORDER).
 */
export const SCHEMA_DIARY_FIELD_KEYS = [
  'trigger',
  'thoughts',
  'bodyFeelings',
  'actualBehavior',
  'schemaOrigin',
  'healthyView',
  'realProblems',
  'excessiveReactions',
  'healthyBehavior',
] as const;

export type SchemaDiaryFieldKey = (typeof SCHEMA_DIARY_FIELD_KEYS)[number];

export interface SchemaDiaryStep {
  key: SchemaDiaryFieldKey;
  /** тёплый вопрос-заголовок шага */
  title: string;
  /** мягкая подсказка под заголовком */
  hint: string;
  /** конкретный пример ответа (плейсхолдер) */
  example: string;
  /** обязательное поле (только ситуация) */
  required?: boolean;
  rows?: number;
}

/**
 * Полный порядок экранов визарда, включая нетекстовые (chip) шаги —
 * единый источник числа/порядка шагов для обоих фронтов (правило №3).
 * 'emotions' и 'schemas' рендерятся своими chip-компонентами (своя разметка
 * на каждом фронте — правило №3 допускает разный UI при общем контенте).
 * 'schemas' шаг также включает текстовое поле schemaOrigin («откуда это
 * знакомо») — единственное текстовое поле, живущее не на своём отдельном
 * экране, а рядом с чипами.
 */
export const SCHEMA_DIARY_STEP_ORDER = [
  'trigger',
  'emotions',
  'thoughts',
  'bodyFeelings',
  'actualBehavior',
  'schemas',
  'healthyView',
  'realProblems',
  'excessiveReactions',
  'healthyBehavior',
] as const;

export type SchemaDiaryStepKind = (typeof SCHEMA_DIARY_STEP_ORDER)[number];

export const buildSchemaDiarySteps = (tr: Tr): SchemaDiaryStep[] => [
  {
    key: 'trigger',
    title: 'Что случилось?',
    hint: tr(
      'Опиши ситуацию — где, с кем, когда.',
      'Опишите ситуацию — где, с кем, когда.',
    ),
    example: 'Например: на созвоне А. сказал, что мой ппт «слабо проработан»…',
    required: true,
    rows: 3,
  },
  {
    key: 'thoughts',
    title: 'Мысли',
    hint: tr(
      'Что говоришь себе? Какие фразы повторяются в голове?',
      'Что говорите себе? Какие фразы повторяются в голове?',
    ),
    example: '«Опять не получилось. Все думают, что я не справляюсь»…',
    rows: 2,
  },
  {
    key: 'bodyFeelings',
    title: 'Тело',
    hint: 'Где это ощущается физически? Сжатие, тяжесть, пульс, дыхание.',
    example: 'Например: ком в горле, плечи как камни, дыхание перехватило…',
    rows: 2,
  },
  {
    key: 'actualBehavior',
    title: 'Моя реакция',
    hint: tr(
      'Что ты делаешь или хочешь сделать?',
      'Что вы делаете или хотите сделать?',
    ),
    example:
      'Например: замолчала, не смогла дочитать свою часть, дома легла и листала ленту…',
    rows: 2,
  },
  {
    key: 'schemaOrigin',
    title: 'Откуда это знакомо?',
    hint: 'Похоже на что-то из прошлого? Из детства? Из других похожих ситуаций?',
    example:
      'Например: так папа в детстве оценивал мои оценки — никогда не было достаточно…',
    rows: 2,
  },
  {
    key: 'healthyView',
    title: 'Здоровый взгляд',
    hint: 'Если убрать схему в сторону — что на самом деле здесь происходит?',
    example:
      'Например: он дал критику, как и другим, — это про работу, не про меня…',
    rows: 2,
  },
  {
    key: 'realProblems',
    title: 'Что реально трудно',
    hint: 'Без раздувания — что в этом моменте по-настоящему сложно?',
    example: 'Например: получать критику при всех — это правда некомфортно…',
    rows: 2,
  },
  {
    key: 'excessiveReactions',
    title: 'Где я преувеличиваю',
    hint: 'Что оказалось крупнее, чем есть на самом деле?',
    example: 'Где реакция оказалась больше, чем требовала ситуация?',
    rows: 2,
  },
  {
    key: 'healthyBehavior',
    title: 'Здоровое поведение',
    hint: tr(
      'Как поступил бы твой Здоровый Взрослый?',
      'Как поступил бы ваш Здоровый Взрослый?',
    ),
    example:
      'Например: спросить Андрея конкретно, что улучшить, дома сделать себе чай вместо ленты…',
    rows: 2,
  },
];

export interface SchemaDiaryChipStepLabel {
  title: string;
  hint: string;
}

/** Заголовок/подсказка для нетекстовых (chip) шагов — «Чувства» и «Схемы». */
export const buildSchemaDiaryChipLabels = (
  tr: Tr,
): Record<'emotions' | 'schemas', SchemaDiaryChipStepLabel> => ({
  emotions: {
    title: 'Чувства',
    hint: tr(
      'Что поднялось внутри — выбери одно или несколько.',
      'Что поднялось внутри — выберите одно или несколько.',
    ),
  },
  schemas: {
    title: 'Схемы',
    hint: tr(
      'Что сработало — выбери схему и, если хочется, допиши, откуда это знакомо.',
      'Что сработало — выберите схему и, если хочется, допишите, откуда это знакомо.',
    ),
  },
});
