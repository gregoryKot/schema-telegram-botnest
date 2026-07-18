// React Flow node/edge type registries. Kept separate from the pure-data module
// because these reference the component implementations (react-refresh: the
// component files must export only components).
import {
  TriggerNode, ChildModeNode, CriticModeNode, CopingModeNode,
  HealthyModeNode, CustomModeNode, BehaviorNode,
} from './ModeMapNodes';
import { FloatingEdge } from './ModeMapFloatingEdge';

export const NODE_TYPES = {
  trigger:  TriggerNode,
  child:    ChildModeNode,
  critic:   CriticModeNode,
  coping:   CopingModeNode,
  healthy:  HealthyModeNode,
  custom:   CustomModeNode,
  behavior: BehaviorNode,
};

export const EDGE_TYPES = { floating: FloatingEdge };
