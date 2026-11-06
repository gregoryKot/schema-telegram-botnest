import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { normalizeModeLinks } from './modeLinks';
import { normalizeSchemaLinks } from './schemaLinks';

/**
 * Поля концептуализации, из которых строится схема: у терапевта — полные, у
 * клиента (ClientSharedConcept) связи без истоков и задач терапии; недостающее
 * поле связи нормализатор заполняет пустым.
 */
export interface ConceptGraphFields {
  schemaIds?: string[];
  modeIds?: string[];
  modeLinks?: Partial<ConceptModeLink>[];
  schemaLinks?: Partial<ConceptSchemaLink>[];
  modeTransitions?: string | null;
}

/** Склеенная с черновиком концептуализация → вход модели графа. */
export function conceptGraphSource(c: ConceptGraphFields): ConceptGraphSource {
  return {
    modeIds: c.modeIds ?? [],
    schemaIds: c.schemaIds ?? [],
    modeLinks: normalizeModeLinks(c.modeLinks),
    schemaLinks: normalizeSchemaLinks(c.schemaLinks),
    modeTransitions: c.modeTransitions,
  };
}
