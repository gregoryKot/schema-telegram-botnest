import { CHILDHOOD_SCHEMA_HINTS } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';

/** id домена, к которому относится первая схема из подсказки; нет такой схемы — undefined. */
export function hintDomainId(id: NeedId): string | undefined {
  const first = CHILDHOOD_SCHEMA_HINTS[id].schemaIds[0];
  return SCHEMA_DOMAINS.find((d) => d.schemas.some((s) => s.id === first))?.id;
}
