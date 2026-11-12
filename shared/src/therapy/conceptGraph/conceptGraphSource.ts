import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { normalizeModeLinks } from './modeLinks';
import { normalizeNeedLinks, type ConceptNeedLink } from './needLinks';
import { normalizeSchemaLinks } from './schemaLinks';

// Поля концептуализации, из которых строится схема. У клиента (ClientSharedConcept)
// связи без истоков и задач терапии (их нормализатор заполняет пустым) и нет колеса.
export interface ConceptGraphFields {
  schemaIds?: string[];
  modeIds?: string[];
  modeLinks?: Partial<ConceptModeLink>[];
  schemaLinks?: Partial<ConceptSchemaLink>[];
  modeTransitions?: string | null;
  needLinks?: ConceptNeedLink[];
}

/** Склеенная с черновиком концептуализация → вход модели графа. */
export function conceptGraphSource(c: ConceptGraphFields): ConceptGraphSource {
  return {
    modeIds: c.modeIds ?? [],
    schemaIds: c.schemaIds ?? [],
    modeLinks: normalizeModeLinks(c.modeLinks),
    schemaLinks: normalizeSchemaLinks(c.schemaLinks),
    modeTransitions: c.modeTransitions,
    needLinks: normalizeNeedLinks(c.needLinks),
  };
}
