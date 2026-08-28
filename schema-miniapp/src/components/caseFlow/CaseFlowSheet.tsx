import { BottomSheet } from '../BottomSheet';
import { CrisisCard } from '../CrisisCard';
import { ModeStateStep } from '../diary/ModeStateStep';
import { ModeCandidateStep } from '../diary/ModeCandidateStep';
import { StepProgress } from '../diary/diaryFlowUi';
import { CaseHeader, TertiaryLink } from './caseFlowUi';
import { CaseHookScreen } from './CaseHookScreen';
import { CaseSceneScreen } from './CaseSceneScreen';
import { CaseBodyScreen } from './CaseBodyScreen';
import { CaseImpulseScreen } from './CaseImpulseScreen';
import { CaseCriterionScreen } from './CaseCriterionScreen';
import { CaseRecognitionScreen } from './CaseRecognitionScreen';
import { CaseNameScreen } from './CaseNameScreen';
import { CaseDoneScreen } from './CaseDoneScreen';
import { useCaseFlow, type CaseFlowSheetProps } from './useCaseFlow';
import { buildSecondDoorNote } from '../../../../shared/src/case/caseImpulses';

export type { CaseFlowSheetProps } from './useCaseFlow';

/**
 * Оркестратор потока «Разбор случая»: чистая JSX-маршрутизация по шагу.
 * Состояние и переходы — в useCaseFlow.ts (composer над useCaseFlowState/
 * useCaseFlowSave), разметка каждого шага — в своём файле (правило №10
 * CLAUDE.md — держим оркестратор тонким).
 */
export function CaseFlowSheet(props: CaseFlowSheetProps) {
  const f = useCaseFlow(props);

  return (
    <BottomSheet onClose={f.handleLater}>
      <div>
        {f.step !== 'hook' && (
          <CaseHeader onBack={f.onBack} onLater={f.handleLater} />
        )}
        {f.progress && (
          <StepProgress
            step={f.progress.step}
            total={5}
            label={f.progress.label}
          />
        )}

        {f.step === 'hook' && (
          <CaseHookScreen
            onStart={f.goToScene}
            onSteadyDay={f.handleSteadyDay}
          />
        )}

        {f.step === 'scene' && (
          <CaseSceneScreen
            value={f.fields.scene}
            chosenFrame={f.fields.chosenFrame}
            onChange={(v) => f.patch({ scene: v })}
            onPickFrame={(frame) =>
              f.patch({
                scene: frame,
                sceneFromFrame: true,
                chosenFrame: frame,
              })
            }
            onNext={f.handleSceneNext}
            tr={f.tr}
          />
        )}

        {f.step === 'gate' && (
          <ModeStateStep
            onPickGroup={f.pickGroup}
            onPickMode={f.pickModeFromGate}
          />
        )}

        {f.step === 'candidate' && f.fields.gateId && (
          <ModeCandidateStep
            groupId={f.fields.gateId}
            onPickMode={f.pickModeFromCandidate}
            onPickGroup={f.pickGroupOnCandidate}
            onBack={f.backToGate}
            showClinicalName={false}
          />
        )}

        {f.step === 'body' && (
          <CaseBodyScreen
            gateId={f.fields.gateId ?? 'unknown'}
            selectedIds={f.fields.bodyChipIds}
            ownValue={f.fields.bodyOwn}
            onToggle={f.toggleBodyChip}
            onOwnChange={(v) => f.patch({ bodyOwn: v })}
            onNext={f.handleBodyNext}
            tr={f.tr}
          />
        )}

        {f.step === 'impulse' && (
          <CaseImpulseScreen
            selectedIds={f.fields.impulseChipIds}
            ownValue={f.fields.impulseOwn}
            onToggle={f.toggleImpulseChip}
            onOwnChange={(v) => f.patch({ impulseOwn: v })}
            onNext={f.handleImpulseNext}
          />
        )}

        {f.step === 'criterion' && (
          <CaseCriterionScreen
            criterion={f.fields.criterion}
            onAnswer={f.handleCriterionAnswer}
            onNext={f.handleCriterionNext}
            saving={f.saving}
            tr={f.tr}
          />
        )}

        {f.step === 'recognition' && f.recognition && (
          <CaseRecognitionScreen
            recognition={f.recognition}
            secondDoorNote={
              f.secondDoorModeId ? buildSecondDoorNote(f.tr) : null
            }
            onNext={f.handleRecognitionNext}
            onDoubt={f.handleDoubt}
          />
        )}

        {f.step === 'name' && (
          <CaseNameScreen
            impulseChipIds={f.fields.impulseChipIds}
            saving={f.saving}
            onConfirm={f.confirmName}
            tr={f.tr}
          />
        )}

        {f.step === 'done' && f.recognition && (
          <CaseDoneScreen
            modeId={f.fields.modeId}
            alias={f.fields.alias}
            traits={f.recognition.traits}
            onOpenMap={props.onOpenMap}
            onClose={f.handleLater}
            tr={f.tr}
          />
        )}

        <TertiaryLink
          label="Тяжело прямо сейчас →"
          onClick={f.handleHardNow}
          muted
        />

        {f.crisis && <CrisisCard surface="case" />}
      </div>
    </BottomSheet>
  );
}
