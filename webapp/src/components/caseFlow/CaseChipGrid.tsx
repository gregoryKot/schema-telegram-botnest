import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';
import { isOwnChipId } from '../../../../shared/src/case/useCaseOwnSync';

/**
 * Шаги body/impulse: поле «своё» + чипы-варианты (правило «одна механика —
 * один компонент»). Twin по смыслу с schema-miniapp CaseChipGrid.tsx,
 * разметка — webapp chip-row/chip-pill (тот же класс, что SchemaChipsStep).
 *
 * Поле рендерится ВСЕГДА и ПЕРВЫМ (фидбек владельца 2026-08-31: «по
 * умолчанию поле ввода, а снизу варианты»), чипы `*_own` («Своё…») не
 * рендерятся вовсе: их id живёт только в selectedIds и поддерживается
 * автосинхронизацией useCaseOwnSync по непустому тексту. Максимум выбора
 * держит вызывающий экран.
 */
export function CaseChipGrid({
  chips,
  selectedIds,
  onToggle,
  ownValue,
  onOwnChange,
  ownPlaceholder,
}: {
  chips: CaseChip[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  ownValue: string;
  onOwnChange: (v: string) => void;
  ownPlaceholder: string;
}) {
  return (
    <div>
      <input
        type="text"
        value={ownValue}
        onChange={(e) => onOwnChange(e.target.value)}
        placeholder={ownPlaceholder}
        aria-label={ownPlaceholder}
        maxLength={60}
        className="field-input"
        style={{ marginBottom: 12 }}
      />
      <div className="chip-row">
        {chips
          .filter((chip) => !isOwnChipId(chip.id))
          .map((chip) => {
            const sel = selectedIds.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                className={'chip-pill ' + (sel ? 'is-selected' : '')}
                onClick={() => onToggle(chip.id)}
              >
                {chip.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
