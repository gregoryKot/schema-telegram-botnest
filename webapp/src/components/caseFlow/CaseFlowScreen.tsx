import { useHistorySheet } from '../../hooks/useHistorySheet';
import { CaseHookScreen } from './CaseHookScreen';
import { CaseSceneScreen } from './CaseSceneScreen';
import { CaseModeScreen } from './CaseModeScreen';
import { CaseBodyScreen } from './CaseBodyScreen';
import { CaseImpulseScreen } from './CaseImpulseScreen';
import { CaseCriterionScreen } from './CaseCriterionScreen';
import { CaseRecognitionScreen } from './CaseRecognitionScreen';
import { CaseNameScreen } from './CaseNameScreen';
import { CaseDoneScreen } from './CaseDoneScreen';
import { CaseSupportProvider } from './CaseSupportFoot';
import { useCaseFlow } from './useCaseFlow';
import { buildSecondDoorNote } from '../../../../shared/src/case/caseImpulses';
import type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';

export type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';
/**
 * Оркестратор потока «Разбор случая» (webapp) — twin schema-miniapp
 * CaseFlowSheet.tsx: полноэкранный ExScreen на каждом шаге, useHistorySheet
 * ОДИН раз здесь (CLAUDE.md) — «Назад»/«Закрыть»/«Дописать потом» зовут
 * exitFlow, а не props.onClose. «Тяжело прямо сейчас» из потока не выводит —
 * карточка поддержки открывается на месте (CaseSupportProvider →
 * CaseSupportBlock); «Открыть карту» идёт напрямую в props.onOpenMap.
 */
export function CaseFlowScreen(props: CaseFlowSheetProps) {
  const exitFlow = useHistorySheet(props.onClose);
  const f = useCaseFlow({ ...props, onClose: exitFlow });
  const pickFrame = (frame: string) =>
    f.patch({ scene: frame, sceneFromFrame: true, chosenFrame: frame });
  return <CaseSupportProvider flow={f}>{renderStep()}</CaseSupportProvider>;
  function renderStep() {
    const back = f.onBack ?? exitFlow;
    switch (f.step) {
      case 'hook':
        return (
          <CaseHookScreen
            onBack={exitFlow}
            onStart={f.goToScene}
            onSteadyDay={f.handleSteadyDay}
            onHardNow={f.handleHardNow}
          />
        );
      case 'scene':
        return (
          <CaseSceneScreen
            value={f.fields.scene}
            chosenFrame={f.fields.chosenFrame}
            onChange={(v) => f.patch({ scene: v })}
            onPickFrame={pickFrame}
            onBack={back}
            onNext={f.handleSceneNext}
            onLater={f.handleLater}
            crisis={f.crisis}
            onHardNow={f.handleHardNow}
            tr={f.tr}
          />
        );
      case 'gate':
        return (
          <CaseModeScreen
            onBack={back}
            onPick={f.pickMode}
            onLater={f.handleLater}
            crisis={f.crisis}
            onHardNow={f.handleHardNow}
          />
        );
      case 'body':
        return (
          <CaseBodyScreen
            gateId={f.fields.gateId ?? 'unknown'}
            selectedIds={f.fields.bodyChipIds}
            ownValue={f.fields.bodyOwn}
            onToggle={f.toggleBodyChip}
            onOwnChange={(v) => f.patch({ bodyOwn: v })}
            onBack={back}
            onNext={f.handleBodyNext}
            onLater={f.handleLater}
            crisis={f.crisis}
            onHardNow={f.handleHardNow}
            tr={f.tr}
          />
        );
      case 'impulse':
        return (
          <CaseImpulseScreen
            selectedIds={f.fields.impulseChipIds}
            ownValue={f.fields.impulseOwn}
            onToggle={f.toggleImpulseChip}
            onOwnChange={(v) => f.patch({ impulseOwn: v })}
            onBack={back}
            onNext={f.handleImpulseNext}
            onLater={f.handleLater}
            crisis={f.crisis}
            onHardNow={f.handleHardNow}
          />
        );
      case 'criterion':
        return (
          <CaseCriterionScreen
            criterion={f.fields.criterion}
            onAnswer={f.handleCriterionAnswer}
            onBack={back}
            onNext={f.handleCriterionNext}
            onLater={f.handleLater}
            saving={f.saving}
            crisis={f.crisis}
            onHardNow={f.handleHardNow}
            tr={f.tr}
          />
        );
      case 'recognition':
        return f.recognition ? (
          <CaseRecognitionScreen
            recognition={f.recognition}
            secondDoorNote={
              f.secondDoorModeId ? buildSecondDoorNote(f.tr) : null
            }
            onNext={f.handleRecognitionNext}
            onDoubt={f.handleDoubt}
            onLater={f.handleLater}
            crisis={f.crisis}
            onHardNow={f.handleHardNow}
          />
        ) : null;
      case 'name':
        return (
          <CaseNameScreen
            impulseChipIds={f.fields.impulseChipIds}
            saving={f.saving}
            onBack={f.handleLater}
            onConfirm={f.confirmName}
            onLater={f.handleLater}
            crisis={f.crisis}
            onHardNow={f.handleHardNow}
            tr={f.tr}
          />
        );
      case 'done':
        return f.recognition ? (
          <CaseDoneScreen
            modeId={f.fields.modeId}
            alias={f.fields.alias}
            traits={f.recognition.traits}
            onOpenMap={props.onOpenMap}
            onClose={f.handleLater}
            tr={f.tr}
          />
        ) : null;
      default:
        return null;
    }
  }
}
