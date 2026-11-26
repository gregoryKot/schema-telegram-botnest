import { getModeById, getSchemaById } from '../../schemaTherapyData';
import type { ClientConceptState } from './clientConceptContext';
import { modeNodeType } from './modeNodeMeta';

/** Что о потребности сказано в концептуализации: ✗ какие схемы блокируют, ✓ какой здоровый режим заботится. */
export function needInConcept(concept: ClientConceptState, needId: string): { blocks: string[]; meets: string[] } {
  if (!concept || concept === 'failed') return { blocks: [], meets: [] };
  const blocks = (concept.schemaLinks ?? []).filter((l) => l.needIds.includes(needId))
    .map((l) => getSchemaById(l.schemaId)?.name).filter((n): n is string => !!n);
  const meets = concept.modeLinks.filter((l) => l.needIds.includes(needId) && modeNodeType(l.modeId).type === 'healthy')
    .map((l) => getModeById(l.modeId)?.name).filter((n): n is string => !!n);
  return { blocks, meets };
}
