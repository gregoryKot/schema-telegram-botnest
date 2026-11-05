import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';
import { isOwnChipId } from '../../../../shared/src/case/useCaseOwnSync';
import { hueStyle } from '../../lib/tone';

/**
 * Шаги body/impulse: поле «своё» + чипы-варианты (правило «одна механика —
 * один компонент»). Разметка — ds-input + ds-chip--toggle (зона нажатия 44px).
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
        className="ds-input ex2-gap-b"
      />
      <div className="ex2-chips" style={hueStyle(undefined)}>
        {chips
          .filter((chip) => !isOwnChipId(chip.id))
          .map((chip) => {
            const sel = selectedIds.includes(chip.id);
            return (
              <button
                key={chip.id} type="button"
                className={'ds-chip ds-chip--toggle' + (sel ? ' is-on' : '')}
                aria-pressed={sel} onClick={() => onToggle(chip.id)}
              >
                {chip.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
