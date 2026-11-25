// Вкладка «Запросы и расстройства» справочника: статьи о том, с чем приходят клиенты. Тип — ./types.ts.
import type { Tr } from '../types';
import { buildAdolescentsGuide } from './adolescents';
import { buildBpdGuide } from './bpd';
import { buildClusterCGuide } from './cluster_c';
import { buildDepressionGuide } from './depression';
import { buildNarcissismGuide } from './narcissism';
import { buildOtherPersonalityDisordersGuide } from './other_personality_disorders';
import type { ConcernGuide, ConcernGuideBuilder } from './types';

export type { ConcernGuide, ConcernGuideBuilder } from './types';

/** Сборщики статей в порядке вкладки. */
export const CONCERN_BUILDERS: ConcernGuideBuilder[] = [
  buildBpdGuide,
  buildNarcissismGuide,
  buildDepressionGuide,
  buildClusterCGuide,
  buildOtherPersonalityDisordersGuide,
  buildAdolescentsGuide,
];

/** Все статьи вкладки «Запросы и расстройства». */
export function buildConcernGuides(tr: Tr): ConcernGuide[] {
  return CONCERN_BUILDERS.map((build) => build(tr));
}
