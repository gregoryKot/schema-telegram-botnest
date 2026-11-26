// Тело POST /api/therapy/conceptualization/:clientId — одно на оба фронтенда
// (раньше собиралось дважды: autoSave в webapp и saveConcept в мини-аппе).
// Принимает структурный тип, чтобы подходили оба локальных
// ClientConceptualization (в webapp у него ещё поля карты режимов).
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import { normalizeModeLinks } from './modeLinks';
import { normalizeSchemaLinks } from './schemaLinks';

export interface ConceptSaveSource {
  schemaIds?: string[];
  modeIds?: string[];
  earlyExperience?: string | null;
  unmetNeeds?: string | null;
  triggers?: string | null;
  copingStyles?: string | null;
  goals?: string | null;
  currentProblems?: string | null;
  modeTransitions?: string | null;
  modeLinks?: ConceptModeLink[];
  schemaLinks?: ConceptSchemaLink[];
}

export interface ConceptSaveBody {
  schemaIds: string[];
  modeIds: string[];
  earlyExperience: string;
  unmetNeeds: string;
  triggers: string;
  copingStyles: string;
  goals: string;
  currentProblems: string;
  modeTransitions: string;
  modeLinks: ConceptModeLink[];
  schemaLinks: ConceptSchemaLink[];
}

export function conceptSaveBody(c: ConceptSaveSource): ConceptSaveBody {
  return {
    schemaIds: c.schemaIds ?? [],
    modeIds: c.modeIds ?? [],
    earlyExperience: c.earlyExperience ?? '',
    unmetNeeds: c.unmetNeeds ?? '',
    triggers: c.triggers ?? '',
    copingStyles: c.copingStyles ?? '',
    goals: c.goals ?? '',
    currentProblems: c.currentProblems ?? '',
    modeTransitions: c.modeTransitions ?? '',
    modeLinks: normalizeModeLinks(c.modeLinks),
    schemaLinks: normalizeSchemaLinks(c.schemaLinks),
  };
}
