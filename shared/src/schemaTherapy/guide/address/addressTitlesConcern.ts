import type { ConcernGuide } from '../concerns/types';
import { PLAN_RUBRIC_LABEL } from '../../../therapy/plan/planItem';
import type { Titles } from './addressTitles';

/** Заголовки разделов статьи «Запросы и расстройства» — как на листе (ConcernGuideSheet). */
export const CONCERN_TITLES: Titles<ConcernGuide> = {
  goal: 'Цель',
  essence: 'Суть',
  criteria: 'Критерии',
  origins: 'Откуда берётся',
  comorbidity: 'Спутники и что лечить первым',
  differential: 'С чем путают',
  modeIds: 'Типичные режимы',
  modeModel: 'Режимная модель',
  schemaIds: 'Типичные схемы',
  inSession: 'В кабинете',
  course: 'Курс терапии',
  crisis: 'Кризис',
  relationship: 'Терапевтические отношения',
  psychoeducation: 'Психообразование',
  formats: 'Форматы',
  evidence: 'Исследования',
  techniques: PLAN_RUBRIC_LABEL.session,
  stuck: 'Где застревают',
  voice: 'Как это звучит',
  more: 'Подробнее',
};
