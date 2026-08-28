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
import { useCaseFlow } from './useCaseFlow';
import { buildSecondDoorNote } from '../../../../shared/src/case/caseImpulses';
import type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';

export type { CaseFlowSheetProps } from '../../../../shared/src/case/caseFlowTypes';

/**
 * Оркестратор потока «Разбор случая» (webapp) — twin schema-miniapp
 * CaseFlowSheet.tsx, но: (1) полноэкранный ExScreen на каждом шаге вместо
 * BottomSheet — webapp-идиома (ModeEntrySheet/GratitudeEntrySheet); (2)
 * useHistorySheet вызывается ОДИН раз здесь, на верхнем уровне компонента
 * с position:fixed;inset:0 (CLAUDE.md) — все «Назад»/«Закрыть»/«Дописать
 * потом»/«Тяжело прямо сейчас» зовут exitFlow (goBack), а не props.onClose
 * напрямую. Единственное исключение — «Открыть карту» (CaseDoneScreen):
 * передача управления в другой уже смонтированный оверлей идёт напрямую
 * через props.onOpenMap, тем же приёмом, что и AllTasksOverlow → TaskCreateSheet
 * в webapp/src/sections/today/AllTasksOverlay.tsx (onAddTask не через goBack).
 */
export function CaseFlowScreen(props: CaseFlowSheetProps) {
  const exitFlow = useHistorySheet(props.onClose);
  const f = useCaseFlow({ ...props, onClose: exitFlow, onHardNow: exitFlow });
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
          onPickFrame={(frame) =>
            f.patch({ scene: frame, sceneFromFrame: true, chosenFrame: frame })
          }
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
          secondDoorNote={f.secondDoorModeId ? buildSecondDoorNote(f.tr) : null}
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
