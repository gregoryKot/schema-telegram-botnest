import { CaseChipGrid } from './CaseChipGrid';
import { PrimaryAction } from '../diary/diaryFlowUi';
import {
  CASE_BODY_CHIPS,
  buildBodyPayoff,
} from '../../../../shared/src/case/caseBodyChips';
import type { CaseGateId, Tr } from '../../../../shared/src/case/caseTypes';

/** Шаг 3 из 5 — телесные приметы. Мультивыбор до двух держит вызывающий
 *  оркестратор (CaseFlowSheet.toggleBodyChip) — экран только рендерит. */
export function CaseBodyScreen({
  gateId,
  selectedIds,
  ownValue,
  onToggle,
  onOwnChange,
  onNext,
  tr,
}: {
  gateId: CaseGateId;
  selectedIds: string[];
  ownValue: string;
  onToggle: (id: string) => void;
  onOwnChange: (v: string) => void;
  onNext: () => void;
  tr: Tr;
}) {
  return (
    <div>
      <div className="d-display" style={{ fontSize: 21, marginBottom: 8 }}>
        Где это отозвалось в теле?
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        {tr(
          'Самое раннее, что успеваешь заметить, — до всяких мыслей.',
          'Самое раннее, что успеваете заметить, — до всяких мыслей.',
        )}
      </div>

      {selectedIds.length > 0 && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--accent)',
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
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

      <div style={{ marginTop: 20 }}>
        <PrimaryAction label="Дальше" onClick={onNext} />
      </div>
    </div>
  );
}
