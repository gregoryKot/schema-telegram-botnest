import { useHistorySheet } from '../../hooks/useHistorySheet';
import { api } from '../../api';
import { CaseSceneStep } from './CaseSceneStep';
import { CaseFeelStep } from './CaseFeelStep';
import { CaseSteadyStep } from './CaseSteadyStep';
import { CaseImpulseStep } from './CaseImpulseStep';
import { CaseResultStep } from './CaseResultStep';
import { CaseModeScreen } from './CaseModeScreen';
import { CaseDoneScreen } from './CaseDoneScreen';
import { CaseSupportProvider } from './CaseSupportFoot';
import { useCaseQuickFlow } from '../../../../shared/src/case/quick/useCaseQuickFlow';
import type { CaseQuickProps } from '../../../../shared/src/case/quick/caseQuick';

export type { CaseQuickProps } from '../../../../shared/src/case/quick/caseQuick';

const DEPS = { trackEvent: api.trackEvent };

/**
 * Оркестратор «Что случилось» на сайте (простой клиент, этап 4): момент →
 * что внутри → что хотелось → итог → «Записано». Полноэкранный ExScreen на
 * каждом шаге, useHistorySheet ОДИН раз здесь (CLAUDE.md): все «Назад» и
 * «Закрыть» идут через exitFlow. «Тяжело прямо сейчас» из потока не выводит —
 * карточка поддержки открывается на месте. Состояние — shared useCaseQuickFlow;
 * мини-апп живёт на старом потоке useCaseFlowState.
 */
export function CaseFlowScreen(props: CaseQuickProps) {
  const exitFlow = useHistorySheet(props.onClose);
  const f = useCaseQuickFlow({ ...props, onClose: exitFlow }, DEPS);
  const common = {
    crisis: f.crisis,
    onHardNow: f.handleHardNow,
    onBack: f.back,
  };

  return <CaseSupportProvider flow={f}>{renderStep()}</CaseSupportProvider>;

  function renderStep() {
    switch (f.step) {
      case 'scene':
        return (
          <CaseSceneStep
            {...common}
            value={f.fields.scene}
            onChange={(v) => f.patch({ scene: v })}
            onNext={f.sceneNext}
          />
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
          <CaseSteadyStep
            {...common}
            saving={f.saving}
            failed={f.saveFailed}
            onSave={f.saveSteady}
          />
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
      case 'result':
        return f.result ? (
          <CaseResultStep
            {...common}
            view={f.result}
            saving={f.saving}
            failed={f.saveFailed}
            onSave={f.save}
            onDoubt={f.openModes}
          />
        ) : null;
      case 'modes':
        return <CaseModeScreen {...common} onPick={f.pickMode} />;
      case 'done':
        return (
          <CaseDoneScreen
            name={f.doneName}
            onOpenMap={props.onOpenMap}
            onClose={exitFlow}
          />
        );
      default:
        return null;
    }
  }
}
