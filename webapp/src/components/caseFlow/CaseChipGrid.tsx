import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';

/**
 * Мультивыбор чипов с раскрывающимся полем «своё» — общий примитив шагов
 * body/impulse (правило «одна механика — один компонент»). Twin по смыслу
 * с schema-miniapp CaseChipGrid.tsx, разметка — webapp chip-row/chip-pill
 * (тот же класс, что SchemaChipsStep/SchemaEmotionsStep, а не копия
 * инлайн-стилей мини-аппа). Максимум выбора держит вызывающий экран.
 */
const isOwnChip = (id: string): boolean => id.endsWith('_own');

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
  const ownSelected = chips.some(
    (c) => isOwnChip(c.id) && selectedIds.includes(c.id),
  );

  return (
    <div>
      <div className="chip-row">
        {chips.map((chip) => {
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
      {ownSelected && (
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
      )}
    </div>
  );
}
