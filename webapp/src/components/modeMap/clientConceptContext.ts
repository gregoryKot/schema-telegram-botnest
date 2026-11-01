import { createContext, useContext } from 'react';
import type { ConceptModeLink } from '../../../../shared/src/apiTypes';

/** Что холсту нужно из концептуализации клиента: схемы, режимы и связь «режим ↔ схемы». */
export interface ClientConcept { schemaIds: string[]; modeIds: string[]; modeLinks: ConceptModeLink[] }
/** null — ещё грузится или клиента нет; 'failed' — сбой (не равен «пусто»). */
export type ClientConceptState = ClientConcept | null | 'failed';

// Связи едут через контекст, а не через data узлов: data сохраняется на сервер, связи клиента туда не пишем.
export const ModeMapConceptContext = createContext<ClientConceptState>(null);

export const useModeMapConcept = (): ClientConceptState => useContext(ModeMapConceptContext);

/** Схемы, уже стоящие на холсте фигурой, — ключ из schemasOnCanvasKey (через пробел). */
export const SchemasOnCanvasContext = createContext<string>('');

export const useSchemasOnCanvas = (): ReadonlySet<string> => new Set(useContext(SchemasOnCanvasContext).split(' ').filter(Boolean));
