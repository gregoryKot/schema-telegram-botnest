import { ExScreen } from '../exercises/ExScreen';
import { CaseChipGrid } from './CaseChipGrid';
import { CaseFlowFoot } from './caseFlowUi';
import { FEEL_GATES } from '../../../../shared/src/mode/modeFeelGates';
import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';
import type { CaseGateId } from '../../../../shared/src/case/caseTypes';
import '../../styles/case-quick.css';

/**
 * Шаг 2 из 3 — «Что внутри?»: ряд ворот чувств, после выбора ворот под ними
 * появляются телесные приметы (необязательно). Ворота «спокойно, хорошо»
 * уводят на «Ровный день» — это решает хук (pickGate), не экран.
 */
export function CaseFeelStep({
  gateId,
  bodyChips,
  bodyIds,
  bodyOwn,
  onGate,
  onToggleBody,
  onBodyOwn,
  onBack,
  onNext,
  crisis,
  onHardNow,
}: {
  gateId: CaseGateId | null;
  bodyChips: CaseChip[];
  bodyIds: string[];
  bodyOwn: string;
  onGate: (id: CaseGateId) => void;
  onToggleBody: (id: string) => void;
  onBodyOwn: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад"
      eyebrow="Что случилось · 2 из 3"
      title="Что внутри?"
      lede="Тело замечает раньше головы."
    >
      <div className="ex2-chips" role="group" aria-label="Что внутри">
        {FEEL_GATES.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={gateId === g.id}
            className={
              'ds-chip ex2-chip' + (gateId === g.id ? ' is-selected' : '')
            }
            onClick={() => onGate(g.id as CaseGateId)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {gateId && (
        <div className="cq-body">
          <div className="ds-label cq-label">
            Где отозвалось в теле? Необязательно
          </div>
          <CaseChipGrid
            chips={bodyChips}
            selectedIds={bodyIds}
            onToggle={onToggleBody}
            ownValue={bodyOwn}
            onOwnChange={onBodyOwn}
            ownPlaceholder="Например: сжало в груди"
          />
        </div>
      )}

      <CaseFlowFoot
        primaryLabel="Дальше"
        primaryDisabled={!gateId}
        onPrimary={onNext}
        crisis={crisis}
        onHardNow={onHardNow}
      />
    </ExScreen>
  );
}
