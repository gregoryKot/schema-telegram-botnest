import type { ConceptGraphModel } from './conceptGraphTypes';

/** Открытый редактор схемы случая: режим или схема по id. */
export type Open = { kind: 'mode' | 'schema'; id: string } | null;

/** Карточка открытого редактора; фигуру сняли с карты — карточки нет, редактор закрыт. */
export function openCards(graph: ConceptGraphModel, open: Open) {
  return {
    modeCard:
      open?.kind === 'mode'
        ? Object.values(graph.lanes)
            .flat()
            .find((c) => c.modeId === open.id)
        : undefined,
    schemaCard:
      open?.kind === 'schema'
        ? graph.schemas.find((s) => s.id === open.id)
        : undefined,
  };
}
