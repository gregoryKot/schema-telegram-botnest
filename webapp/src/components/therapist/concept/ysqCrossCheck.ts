import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import type { YsqHistoryEntry } from '../../../../../shared/src/apiTypes';
import { historyScoresByName } from '../../../../../shared/src/hooks/ysqScoring';
import { rankExpressed, type ExpressedSchema } from '../../../sections/schemas/schemasModel';

export interface CrossCheckItem extends ExpressedSchema { inConcept: boolean }

/**
 * «Сверка с YSQ»: выраженные по YSQ схемы (ysqActiveSchemaIds с сервера) в
 * том же порядке, что «Выраженные схемы» у клиента (rankExpressed — средний
 * балл, затем доля «5–6» последнего прохождения), с пометкой, есть ли схема в
 * концептуализации. Раньше брались первые шесть по порядку списка схем, а не
 * по выраженности, и остальные молча отрезались (QA 2026-10-26).
 */
export function crossCheckItems(ysqActiveIds: string[], latest: YsqHistoryEntry | undefined, conceptSchemaIds: string[]): CrossCheckItem[] {
  const scores = latest ? historyScoresByName(latest) : {};
  return rankExpressed(SCHEMA_DOMAINS, ysqActiveIds, scores)
    .map(s => ({ ...s, inConcept: conceptSchemaIds.includes(s.id) }));
}
