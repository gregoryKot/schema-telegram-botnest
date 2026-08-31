import { CaseChipGrid } from './CaseChipGrid';
import { PrimaryAction } from '../diary/diaryFlowUi';
import { CASE_IMPULSES } from '../../../../shared/src/case/caseImpulses';

/** Шаг 4 из 5 — порывы. Мультивыбор до трёх держит оркестратор
 *  (toggleImpulseChip также считает suggestSecondDoor — см. CaseFlowSheet). */
export function CaseImpulseScreen({
  selectedIds,
  ownValue,
  onToggle,
  onOwnChange,
  onNext,
}: {
  selectedIds: string[];
  ownValue: string;
  onToggle: (id: string) => void;
  onOwnChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="d-display" style={{ fontSize: 21, marginBottom: 8 }}>
        Что потянуло сделать?
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        Не что вышло в итоге — куда тянуло.
      </div>

      <CaseChipGrid
        chips={CASE_IMPULSES}
        selectedIds={selectedIds}
        onToggle={onToggle}
        ownValue={ownValue}
        onOwnChange={onOwnChange}
        ownPlaceholder="Например: хотелось всё бросить"
      />

      <div style={{ marginTop: 20 }}>
        <PrimaryAction label="Дальше" onClick={onNext} />
      </div>
    </div>
  );
}
