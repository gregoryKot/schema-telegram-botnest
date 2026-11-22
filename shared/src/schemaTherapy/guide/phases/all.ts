// Вкладка «Путь терапии» справочника: условные фазы по порядку. Тип — ./types.ts.
import type { Tr } from '../types';
import { buildPathOverview } from './overview';
import { EARLY_PHASES } from './early';
import { LATE_PHASES } from './late';
import { buildTemplateSheets } from './templateSheets';
import type { PhaseGuide, PhaseGuideBuilder } from './types';

export type {
  PathSheetGroupId,
  PhaseGuide,
  PhaseGuideBuilder,
} from './types';

/** Сборщики листов в порядке пути: обзор, затем шесть фаз. */
export const PHASE_BUILDERS: PhaseGuideBuilder[] = [
  buildPathOverview,
  ...EARLY_PHASES,
  ...LATE_PHASES,
];

/** Все листы вкладки «Путь терапии»: лента фаз по порядку, за ней листы шаблонов пути. */
export function buildPhaseGuides(tr: Tr): PhaseGuide[] {
  const path = PHASE_BUILDERS.map((build) => build(tr));
  return [...path, ...buildTemplateSheets(tr, path)];
}

/** Типичная длительность фазы в сессиях — только там, где её называет книга: шаблон для плана клиента. */
export const PHASE_SESSIONS: Partial<
  Record<string, { from: number; to: number }>
> = {
  assessment: { from: 5, to: 8 },
};
