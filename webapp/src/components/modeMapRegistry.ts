// React Flow node/edge type registries (separate from modeMapData.ts: react-refresh, component files export only components).
import {
  TriggerNode, ChildModeNode, CriticModeNode, CopingModeNode,
  HealthyModeNode, CustomModeNode, BehaviorNode,
} from './ModeMapNodes';
import { SchemaNode, OriginNode, NeedNode, NeedsHubNode } from './modeMap/ConceptNodes';
import { FloatingEdge } from './ModeMapFloatingEdge';

export const NODE_TYPES = {
  trigger:  TriggerNode,
  child:    ChildModeNode,
  critic:   CriticModeNode,
  coping:   CopingModeNode,
  healthy:  HealthyModeNode,
  custom:   CustomModeNode,
  behavior: BehaviorNode,
  schema: SchemaNode, origin: OriginNode, need: NeedNode, needs: NeedsHubNode,
};

export const EDGE_TYPES = { floating: FloatingEdge };
