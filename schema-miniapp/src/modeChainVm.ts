// Обёртка shared/mode/modeChain.modeChainVm с уже привязанным getModeById
// этого фронта — ModeChainSuggestion.tsx не импортирует getModeById сам
// (единственный потребитель), голова компонента короче.
import { getModeById } from './schemaTherapyData';
import { modeChainVm } from '../../shared/src/mode/modeChain';

type Tr = (ty: string, vy: string) => string;

export function modeChainVmLocal(modeId: string, tr: Tr) {
  return modeChainVm(modeId, tr, getModeById);
}

export type { ModeChainSuggestionProps } from '../../shared/src/mode/modeChain';
