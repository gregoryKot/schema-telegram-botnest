// Вкладка «Путь терапии» справочника: условные фазы по порядку. Тип — ./types.ts.
import type { Tr } from '../types';
import { buildPathOverview } from './overview';
import { EARLY_PHASES } from './early';
import { LATE_PHASES } from './late';
import type { PhaseGuide, PhaseGuideBuilder } from './types';

export type { PhaseGuide, PhaseGuideBuilder } from './types';

/** Сборщики листов в порядке пути: обзор, затем шесть фаз. */
export const PHASE_BUILDERS: PhaseGuideBuilder[] = [
  buildPathOverview,
  ...EARLY_PHASES,
  ...LATE_PHASES,
];

/** Все листы вкладки «Путь терапии», по порядку. */
export function buildPhaseGuides(tr: Tr): PhaseGuide[] {
  return PHASE_BUILDERS.map((build) => build(tr));
}

/** Типичная длительность фазы в сессиях — только там, где её называет книга: шаблон для плана клиента. */
export const PHASE_SESSIONS: Partial<
  Record<string, { from: number; to: number }>
> = {
  assessment: { from: 5, to: 8 },
};
