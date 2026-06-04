import { createContext, useContext } from 'react';

export interface NodeActions {
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  edit: (id: string) => void;     // open the side editor for this node
  rename: (id: string, label: string) => void;  // inline rename from the node
}

export const NodeActionsContext = createContext<NodeActions | null>(null);

export function useNodeActions(): NodeActions | null {
  return useContext(NodeActionsContext);
}
