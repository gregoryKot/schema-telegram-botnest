// Типы модели графической концептуализации (см. conceptGraphModel.ts).
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import type { ConceptLane, CopingKind } from './modeLanes';

export interface ConceptGraphSource {
  modeIds: string[];
  schemaIds: string[];
  modeLinks: ConceptModeLink[];
  schemaLinks: ConceptSchemaLink[];
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
  lane: ConceptLane;
  copingKind?: CopingKind;
  /** Схемы, которые включают режим (⇄ на схеме случая). */
  schemas: GraphSchemaChip[];
  /** Потребности, о которых заботится здоровый режим (✓ на схеме случая). */
  needs: GraphNeedChip[];
  /** Текст на фигуре: что говорит / делает / на что опирается. */
  manifest: string;
  strategyHint: string;
  empty: boolean;
}

/** Схема на схеме случая: убеждение, детский опыт и блокируемые потребности. */
export interface GraphSchemaCard extends GraphSchemaChip {
  domain: string;
  belief: string;
  origin: string;
  /** Блокируемые потребности в порядке NEED_ORDER (✗ на схеме случая). */
  needIds: string[];
  empty: boolean;
}

export type GapId = 'coping_without_child' | 'no_angry' | 'unlinked';

export interface ConceptGraphModel {
  lanes: Record<ConceptLane, GraphModeCard[]>;
  schemas: GraphSchemaCard[];
  sequence: string;
  gaps: { id: GapId; text: string }[];
  modeCount: number;
}
