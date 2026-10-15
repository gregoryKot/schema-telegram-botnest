import type { ConceptModeLink } from '../../apiTypes';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { normalizeModeLinks } from './modeLinks';

/** Поля концептуализации, из которых строится схема (обе площадки). */
export interface ConceptGraphFields {
  schemaIds?: string[];
  modeIds?: string[];
  modeLinks?: ConceptModeLink[];
  earlyExperience?: string | null;
  unmetNeeds?: string | null;
  triggers?: string | null;
  currentProblems?: string | null;
  goals?: string | null;
  modeTransitions?: string | null;
}

/** Склеенная с черновиком концептуализация → вход модели графа. */
export function conceptGraphSource(c: ConceptGraphFields): ConceptGraphSource {
  return {
    modeIds: c.modeIds ?? [],
    schemaIds: c.schemaIds ?? [],
    modeLinks: normalizeModeLinks(c.modeLinks),
    earlyExperience: c.earlyExperience,
    unmetNeeds: c.unmetNeeds,
    triggers: c.triggers,
    currentProblems: c.currentProblems,
    goals: c.goals,
    modeTransitions: c.modeTransitions,
  };
}
