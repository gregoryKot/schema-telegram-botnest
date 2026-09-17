import { ExScreen } from '../exercises/ExScreen';
import { CaseChipGrid } from './CaseChipGrid';
import { CaseFlowFoot } from './caseFlowUi';
import {
  CASE_BODY_CHIPS,
  buildBodyPayoff,
} from '../../../../shared/src/case/caseBodyChips';
import type { CaseGateId, Tr } from '../../../../shared/src/case/caseTypes';

/** Шаг 3 из 5 — телесные приметы. Twin schema-miniapp CaseBodyScreen.tsx. */
export function CaseBodyScreen({
  gateId,
  selectedIds,
  ownValue,
  onToggle,
  onOwnChange,
  onBack,
  onNext,
  onLater,
  crisis,
  onHardNow,
  tr,
}: {
  gateId: CaseGateId;
  selectedIds: string[];
  ownValue: string;
  onToggle: (id: string) => void;
  onOwnChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onLater: () => void;
  crisis: boolean;
  onHardNow: () => void;
  tr: Tr;
}) {
  return (
    <ExScreen
      onBack={onBack}
      eyebrow="Разбор случая · Шаг 3 из 5"
      eyebrowColor="var(--accent-indigo)"
      title="Где это отозвалось в теле?"
      lede={tr(
        'Самое раннее, что успеваешь заметить, — до всяких мыслей.',
        'Самое раннее, что успеваете заметить, — до всяких мыслей.',
      )}
    >
      {selectedIds.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 14 }}>
          {buildBodyPayoff(tr)}
        </div>
      )}

      <CaseChipGrid
        chips={CASE_BODY_CHIPS[gateId]}
        selectedIds={selectedIds}
        onToggle={onToggle}
        ownValue={ownValue}
        onOwnChange={onOwnChange}
        ownPlaceholder="Например: сжало в груди"
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
