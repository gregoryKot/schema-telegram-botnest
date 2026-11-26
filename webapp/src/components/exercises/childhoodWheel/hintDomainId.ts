import { CHILDHOOD_SCHEMA_HINTS } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';

/** Номер домена первой схемы подсказки (DomainArt: 1… по порядку SCHEMA_DOMAINS); нет такой схемы — 0. */
export function hintDomainNum(id: NeedId): number {
  const first = CHILDHOOD_SCHEMA_HINTS[id].schemaIds[0];
  return SCHEMA_DOMAINS.findIndex((d) => d.schemas.some((s) => s.id === first)) + 1;
}
