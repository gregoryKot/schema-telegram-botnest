// Типы модели графической концептуализации (см. conceptGraphModel.ts).
import type { ConceptModeLink } from '../../apiTypes';
import type { ConceptLane, CopingKind } from './modeLanes';

export interface ConceptGraphSource {
  modeIds: string[];
  schemaIds: string[];
  modeLinks: ConceptModeLink[];
  earlyExperience?: string | null;
  unmetNeeds?: string | null;
  triggers?: string | null;
  currentProblems?: string | null;
  goals?: string | null;
  modeTransitions?: string | null;
}

export interface GraphSchemaChip {
  id: string;
  name: string;
  color: string;
}

export interface GraphNeedChip {
  id: string;
  name: string;
}

export interface GraphModeCard {
  modeId: string;
  name: string;
  alias: string;
  color: string;
  copingKind?: CopingKind;
  schemas: GraphSchemaChip[];
  needs: GraphNeedChip[];
  origin: string;
  manifest: string;
  strategy: string;
  strategyHint: string;
  empty: boolean;
}

export type GapId = 'coping_without_child' | 'no_angry' | 'unlinked';

export interface ConceptGraphModel {
  lanes: Record<ConceptLane, GraphModeCard[]>;
  trigger: string;
  goals: string;
  problems: string;
  sequence: string;
  roots: {
    experience: string;
    unmetNeeds: string;
    needs: GraphNeedChip[];
    schemas: GraphSchemaChip[];
  };
  gaps: { id: GapId; text: string }[];
  modeCount: number;
}
