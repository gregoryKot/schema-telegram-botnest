import { useHistorySheet } from '../../hooks/useHistorySheet';
import { api } from '../../api';
import { CaseSceneStep } from './CaseSceneStep';
import { CaseFeelStep } from './CaseFeelStep';
import { CaseSteadyStep } from './CaseSteadyStep';
import { CaseImpulseStep } from './CaseImpulseStep';
import { CaseNeedStep } from './CaseNeedStep';
import { CaseResultStep } from './CaseResultStep';
import { CaseModeScreen } from './CaseModeScreen';
import { CaseDoneScreen } from './CaseDoneScreen';
import { CaseSupportProvider } from './CaseSupportFoot';
import { CaseResumeGate } from './CaseResumeGate';
import { CaseCollectedProvider } from './CaseStepScreen';
import { collectedRows } from './caseSummary';
import { useCaseModeHistory } from './useCaseModeHistory';
import { todayStr } from '../../utils/format';
import { modeRepeatCount } from '../../../../shared/src/case/quick/caseRepeat';
import { useCaseQuickFlow } from '../../../../shared/src/case/quick/useCaseQuickFlow';
import { STEADY_GATE_ID, type CaseQuickProps } from '../../../../shared/src/case/quick/caseQuick';

export type { CaseQuickProps } from '../../../../shared/src/case/quick/caseQuick';

const DEPS = { trackEvent: api.trackEvent };

/**
 * Оркестратор «Что случилось» на сайте (простой клиент, этап 4): момент → что
 * внутри → что хотелось → чего не хватило → итог → «Записано». Рамка шага — CaseStepScreen (лист шалфея,
 * на компьютере разворот с «Что собрали»), useHistorySheet ОДИН раз здесь: все «Назад»/
 * «Закрыть» идут через exitFlow. «Тяжело прямо сейчас» открывает поддержку на месте.
 * Состояние — shared useCaseQuickFlow; черновик — сначала «продолжить или заново».
 */
export function CaseFlowScreen(props: CaseQuickProps) {
  const exitFlow = useHistorySheet(props.onClose);
  return <CaseResumeGate onBack={exitFlow}><CaseFlowSteps {...props} onClose={exitFlow} /></CaseResumeGate>;
}

function CaseFlowSteps(props: CaseQuickProps) {
  const f = useCaseQuickFlow(props, DEPS);
  const history = useCaseModeHistory();
  const common = { crisis: f.crisis, onHardNow: f.handleHardNow, onBack: f.back };
  const collected = collectedRows(f.step, f.fields, f.bodyChips);
  return (
    <CaseSupportProvider flow={f}>
      <CaseCollectedProvider rows={collected}>{renderStep()}</CaseCollectedProvider>
    </CaseSupportProvider>
  );

  function renderStep() {
    switch (f.step) {
      case 'scene':
        return (
          <CaseSceneStep {...common} value={f.fields.scene} onChange={(v) => f.patch({ scene: v })} onNext={f.sceneNext} />
        );
      case 'feel':
        return (
          <CaseFeelStep
            {...common}
            gateId={f.fields.gateId}
            bodyChips={f.bodyChips}
            bodyIds={f.fields.bodyChipIds}
            bodyOwn={f.fields.bodyOwn}
            onGate={f.pickGate}
            onToggleBody={f.toggleBodyChip}
            onBodyOwn={(v) => f.patch({ bodyOwn: v })}
            onNext={f.feelNext}
          />
        );
      case 'steady':
        return (
          <CaseSteadyStep {...common} saving={f.saving} failed={f.saveFailed} onSave={f.saveSteady} />
        );
      case 'impulse':
        return (
          <CaseImpulseStep
            {...common}
            selectedIds={f.fields.impulseChipIds}
            ownValue={f.fields.impulseOwn}
            onToggle={f.toggleImpulseChip}
            onOwnChange={(v) => f.patch({ impulseOwn: v })}
            onNext={f.impulseNext}
          />
        );
      case 'need':
        return <CaseNeedStep {...common} needId={f.fields.needId} onPick={f.pickNeed} onNext={f.needNext} />;
      case 'result':
        return f.result ? (
          <CaseResultStep
            {...common}
            view={f.result}
            saving={f.saving}
            failed={f.saveFailed}
            onSave={f.save}
            onDoubt={f.openModes}
            firstMode={history !== null && history.length === 0}
          />
        ) : null;
      case 'modes':
        return <CaseModeScreen {...common} onPick={f.pickMode} />;
      case 'done':
        return (
          <CaseDoneScreen
            name={f.doneName} steady={f.fields.gateId === STEADY_GATE_ID}
            repeat={history ? modeRepeatCount(history, f.savedModeId, todayStr()) : 1}
            needId={f.fields.needId} onOpenTracker={props.onOpenTracker} onOpenMap={props.onOpenMap} onClose={props.onClose} crisis={f.crisis} onHardNow={f.handleHardNow}
          />
        );
      default:
        return null;
    }
  }
}
