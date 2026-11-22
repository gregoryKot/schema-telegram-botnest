// Вкладка «Запросы и расстройства» справочника: статьи о том, с чем приходят клиенты. Тип — ./types.ts.
import type { Tr } from '../types';
import { buildBpdGuide } from './bpd';
import { buildNarcissismGuide } from './narcissism';
import type { ConcernGuide, ConcernGuideBuilder } from './types';

export type { ConcernGuide, ConcernGuideBuilder } from './types';

/** Сборщики статей в порядке вкладки. */
export const CONCERN_BUILDERS: ConcernGuideBuilder[] = [
  buildBpdGuide,
  buildNarcissismGuide,
];

/** Все статьи вкладки «Запросы и расстройства». */
export function buildConcernGuides(tr: Tr): ConcernGuide[] {
  return CONCERN_BUILDERS.map((build) => build(tr));
}
