import { haptic } from '../../haptic';
import { api } from '../../api';
import {
  useCaseFlowState,
  type CaseFlowStateDeps,
} from '../../../../shared/src/case/useCaseFlowState';
import { useCaseFlowSave } from '../../../../shared/src/case/useCaseFlowSave';
import { NO_BACK_STEPS } from '../../../../shared/src/case/caseFlowTypes';
import type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';
import { gateIdForMode } from '../../../../shared/src/case/caseFlowMappers';

export type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';

const DEPS: CaseFlowStateDeps = { trackEvent: api.trackEvent };

/**
 * Композиция общего состояния/сохранения потока (shared/src/case, правило
 * №3) с единственным, что у площадок по-разному устроено — выбором режима:
 * webapp переиспользует уже существующий механизм ModeFeelingBrowse (один
 * экран, правило «одна механика — один компонент»), поэтому здесь только
 * `pickMode`, а не пара gate/candidate, как у schema-miniapp
 * (schema-miniapp/src/components/caseFlow/useCaseFlow.ts). goBack — тоже
 * здесь: таблица переходов между шагами короче миниапповской ровно на шаг
 * candidate, которого у этой площадки нет.
 */
export function useCaseFlow(props: CaseFlowSheetProps) {
  const state = useCaseFlowState(props.onClose, props.onSteadyDay, DEPS);
  const save = useCaseFlowSave(state, props, DEPS);
  const { step, setStep, patch } = state;

  const goBack = () => {
    haptic.tap();
    if (step === 'scene') setStep('hook');
    else if (step === 'gate') setStep('scene');
    else if (step === 'body') setStep('gate');
    else if (step === 'impulse') setStep('body');
    else if (step === 'criterion') setStep('impulse');
  };

  const pickMode = (id: string) => {
    haptic.select();
    patch({ modeId: id, gateId: gateIdForMode(id) });
    setStep('body');
  };

  return {
    ...state,
    ...save,
    onBack: NO_BACK_STEPS.has(step) ? undefined : goBack,
    pickMode,
  };
}
