// Вкладка «Запросы и расстройства» справочника: статьи о том, с чем приходят клиенты. Тип — ./types.ts.
import type { Tr } from '../types';
import { buildAdjustmentDisorderGuide } from './adjustment_disorder';
import { buildAdolescentsGuide } from './adolescents';
import { buildAnxietyGuide } from './anxiety';
import { buildBpdGuide } from './bpd';
import { buildClusterCGuide } from './cluster_c';
import { buildCouplesGuide } from './couples';
import { buildDepressionGuide } from './depression';
import { buildEatingDisordersGuide } from './eating_disorders';
import { buildNarcissismGuide } from './narcissism';
import { buildOcdGuide } from './ocd';
import { buildOtherPersonalityDisordersGuide } from './other_personality_disorders';
import { buildPtsdGuide } from './ptsd';
import type { ConcernGuide, ConcernGuideBuilder } from './types';

export type { ConcernGuide, ConcernGuideBuilder } from './types';

/** Сборщики статей в порядке вкладки. */
export const CONCERN_BUILDERS: ConcernGuideBuilder[] = [
  buildBpdGuide,
  buildNarcissismGuide,
  buildDepressionGuide,
  buildAnxietyGuide,
  buildOcdGuide,
  buildAdjustmentDisorderGuide,
  buildClusterCGuide,
  buildOtherPersonalityDisordersGuide,
  buildAdolescentsGuide,
  buildCouplesGuide,
  buildPtsdGuide,
  buildEatingDisordersGuide,
];

/** Все статьи вкладки «Запросы и расстройства». */
export function buildConcernGuides(tr: Tr): ConcernGuide[] {
  return CONCERN_BUILDERS.map((build) => build(tr));
}
