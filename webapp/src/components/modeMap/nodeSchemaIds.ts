import { getSchemaById } from '../../schemaTherapyData';
import type { ClientConceptState } from './clientConceptContext';

export const MAX_SCHEMA_PILLS = 3;

/** Схемы узла: своя `schemaId` первой, затем схемы из связей режима клиента; без дублей и без неизвестных id. */
export function nodeSchemaIds(schemaId: string | undefined, linked: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of [schemaId, ...linked]) {
    if (id && !out.includes(id) && getSchemaById(id)) out.push(id);
  }
  return out;
}

/**
 * Схемы из связей режима клиента для таблеток узла. Только у режима, который
 * сейчас есть в концептуализации: связь снятого режима спит и вернётся вместе с
 * ним (modeLinks.ts), остальные экраны её тоже не показывают. И без схем, что
 * уже стоят на холсте отдельной фигурой: там их видно и так, а лишняя таблетка
 * растила бы узел карты «Открыть на холсте» после её раскладки — фигуры
 * наезжали бы друг на друга.
 */
export function linkedSchemaIds(concept: ClientConceptState, modeId: string | undefined, onCanvas: ReadonlySet<string>): string[] {
  if (!modeId || !concept || concept === 'failed' || !concept.modeIds.includes(modeId)) return [];
  return (concept.modeLinks.find(l => l.modeId === modeId)?.schemaIds ?? []).filter(id => !onCanvas.has(id));
}

/** Схемы, стоящие на холсте фигурой «схема», одной строкой: узлы перерисовываются только при смене набора, а не на каждом движении. */
export function schemasOnCanvasKey(nodes: readonly { type?: string; data?: Record<string, unknown> }[]): string {
  const ids = nodes.filter(n => n.type === 'schema').map(n => n.data?.schemaId).filter((id): id is string => typeof id === 'string');
  return [...new Set(ids)].sort().join(' ');
}
