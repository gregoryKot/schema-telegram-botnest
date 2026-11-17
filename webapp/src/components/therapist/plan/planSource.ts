import { getModeById, getSchemaById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { Guide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { PlanSource } from '../../../../../shared/src/therapy/plan/planItem';

type Tr = Parameters<Guide['modeGuide']>[0];

/**
 * Название статьи справочника, из которой взят пункт плана, — для ссылки «Из справочника: … →».
 * null — ссылки нет: тексты справочника ещё не приехали, либо статьи с таким id больше нет.
 */
export function planSourceTitle(guide: Guide | null | undefined, tr: Tr, source: PlanSource | null): string | null {
  if (!guide || !source) return null;
  switch (source.kind) {
    case 'mode': return guide.modeGuide(tr, source.id) ? getModeById(source.id)?.name ?? null : null;
    case 'schema': return guide.schemaGuide(tr, source.id) ? getSchemaById(source.id)?.name ?? null : null;
    case 'technique': return guide.techniqueGuide(tr, source.id as TechniqueId)?.name ?? null;
    default: return null;
  }
}
