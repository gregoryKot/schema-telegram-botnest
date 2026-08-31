import { haptic } from '../../haptic';
import { api } from '../../api';
import {
  useCaseFlowState,
  type CaseFlowStateDeps,
} from '../../../../shared/src/case/useCaseFlowState';
import { useCaseFlowSave } from '../../../../shared/src/case/useCaseFlowSave';
import { NO_BACK_STEPS } from '../../../../shared/src/case/caseFlowTypes';
import type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';
import {
  asCaseGateId,
  gateIdForMode,
} from '../../../../shared/src/case/caseFlowMappers';

export type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';

const DEPS: CaseFlowStateDeps = { trackEvent: api.trackEvent };

/**
 * Композиция общего состояния/сохранения потока (shared/src/case, правило
 * №3) с единственным, что у площадок по-разному устроено — выбором режима:
 * миниапп заходит через ворота FEEL_GATES (gate) к кандидатам (candidate),
 * webapp — одним экраном (webapp/src/components/caseFlow/useCaseFlow.ts,
 * pickMode). Здесь же — goBack: переходы между шагами тоже завязаны на этот
 * двухшаговый выбор, поэтому таблица переходов у площадок разная.
 */
export function useCaseFlow(props: CaseFlowSheetProps) {
  const state = useCaseFlowState(props.onClose, props.onSteadyDay, DEPS);
  const save = useCaseFlowSave(state, props, DEPS);
  const { step, setStep, fields, patch } = state;

  const goBack = () => {
    haptic.tap();
    if (step === 'scene') setStep('hook');
    else if (step === 'gate') setStep('scene');
    else if (step === 'candidate') {
      patch({ gateId: null });
      setStep('gate');
    } else if (step === 'body') setStep('candidate');
    else if (step === 'impulse') setStep('body');
    else if (step === 'criterion') setStep('impulse');
  };

  const pickGroup = (id: string) => {
    patch({ gateId: asCaseGateId(id) });
    setStep('candidate');
  };
  const pickModeFromGate = (id: string) => {
    patch({ modeId: id, gateId: fields.gateId ?? gateIdForMode(id) });
    setStep('body');
  };
  const pickModeFromCandidate = (id: string) => {
    patch({ modeId: id });
    setStep('body');
  };
  const backToGate = () => {
    patch({ gateId: null });
    setStep('gate');
  };
  const pickGroupOnCandidate = (id: string) =>
    patch({ gateId: asCaseGateId(id) });

  return {
    ...state,
    ...save,
    onBack: NO_BACK_STEPS.has(step) ? undefined : goBack,
    pickGroup,
    pickModeFromGate,
    pickModeFromCandidate,
    backToGate,
    pickGroupOnCandidate,
  };
}
