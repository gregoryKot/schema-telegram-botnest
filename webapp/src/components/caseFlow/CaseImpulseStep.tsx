import { ExScreen } from '../exercises/ExScreen';
import { CaseChipGrid } from './CaseChipGrid';
import { CaseFlowFoot } from './caseFlowUi';
import { CASE_IMPULSES } from '../../../../shared/src/case/caseImpulses';

/** Шаг 3 из 3 — «Что хотелось сделать?»: порывы, до трёх, нужен хотя бы один. */
export function CaseImpulseStep({
  selectedIds,
  ownValue,
  onToggle,
  onOwnChange,
  onBack,
  onNext,
  crisis,
  onHardNow,
}: {
  selectedIds: string[];
  ownValue: string;
  onToggle: (id: string) => void;
  onOwnChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад"
      eyebrow="Что случилось · 3 из 3"
      title="Что хотелось сделать?"
      lede="Не то, что получилось, а первый импульс."
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
        primaryLabel="Что это было?"
        primaryDisabled={selectedIds.length === 0}
        onPrimary={onNext}
        crisis={crisis}
        onHardNow={onHardNow}
      />
    </ExScreen>
  );
}
