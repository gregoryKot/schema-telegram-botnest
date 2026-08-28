import { useCaseFlowState } from './useCaseFlowState';
import { useCaseFlowSave } from './useCaseFlowSave';
import type { CaseFlowSheetProps } from './caseFlowTypes';

export type { CaseFlowSheetProps } from './caseFlowTypes';

/**
 * Композиция состояния (useCaseFlowState — hook…criterion) и сохранения
 * (useCaseFlowSave — criterion…done) в единый объект для CaseFlowSheet.tsx.
 * Разделены правилом №10 CLAUDE.md (300 строк на файл); здесь только склейка.
 */
export function useCaseFlow(props: CaseFlowSheetProps) {
  const state = useCaseFlowState(
    props.onClose,
    props.onSteadyDay,
    props.onHardNow,
  );
  const save = useCaseFlowSave(state, props);

  return { ...state, ...save };
}
