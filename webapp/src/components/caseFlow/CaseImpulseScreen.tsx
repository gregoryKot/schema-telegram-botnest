import { ExScreen } from '../exercises/ExScreen';
import { CaseChipGrid } from './CaseChipGrid';
import { CaseFlowFoot } from './caseFlowUi';
import { CASE_IMPULSES } from '../../../../shared/src/case/caseImpulses';

/** Шаг 4 из 5 — порывы. Twin schema-miniapp CaseImpulseScreen.tsx. */
export function CaseImpulseScreen({
  selectedIds,
  ownValue,
  onToggle,
  onOwnChange,
  onBack,
  onNext,
  onLater,
  crisis,
  onHardNow,
}: {
  selectedIds: string[];
  ownValue: string;
  onToggle: (id: string) => void;
  onOwnChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onLater: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  return (
    <ExScreen
      onBack={onBack}
      eyebrow="Разбор случая · Шаг 4 из 5"
      eyebrowColor="var(--accent-indigo)"
      title="Что потянуло сделать?"
      lede="Не что вышло в итоге — куда тянуло."
    >
      <CaseChipGrid
        chips={CASE_IMPULSES}
        selectedIds={selectedIds}
        onToggle={onToggle}
        ownValue={ownValue}
        onOwnChange={onOwnChange}
        ownPlaceholder="Например: хотелось всё бросить"
      />

      <CaseFlowFoot
        primaryLabel="Дальше"
        onPrimary={onNext}
        onLater={onLater}
        crisis={crisis}
        onHardNow={onHardNow}
      />
    </ExScreen>
  );
}
