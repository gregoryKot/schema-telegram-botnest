import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';

/**
 * Мультивыбор чипов с раскрывающимся полем «своё» — общий примитив шагов
 * body/impulse (правило «одна механика — один компонент»: без него оба шага
 * писали бы одну и ту же раскладку дважды, как раньше случилось с оценкой
 * потребности — см. CLAUDE.md). Максимум выбора и текст «своего» плейсхолдера
 * держит вызывающий экран — здесь только механика тапа/раскрытия.
 *
 * Чип с id, оканчивающимся на `_own`, раскрывает однострочное поле — тот же
 * визуальный стиль пилюли, что у SchemaPicker.tsx (диары-конвенция «тёплой
 * бумаги»), но здесь: своя копия не заводится, переиспользуется только сам
 * стиль (SchemaPicker сам жёстко привязан к доменам схем, как компонент не
 * подходит).
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
        {chips.map((chip) => {
          const sel = selectedIds.includes(chip.id);
          return (
            <button
              key={chip.id}
              onClick={() => onToggle(chip.id)}
              className="sel-btn"
              style={{
                background: sel ? 'var(--accent-bg)' : 'var(--surface)',
                border: sel
                  ? '1px solid var(--accent)'
                  : '1px solid rgba(34,30,27,0.1)',
                borderRadius: 999,
                padding: '10px 14px',
                minHeight: 44,
                color: sel ? 'var(--accent)' : 'var(--ink-2)',
                fontSize: 13,
                fontWeight: sel ? 600 : 400,
                cursor: 'pointer',
              }}
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
          style={{
            marginTop: 'var(--space-12)',
            width: '100%',
            background: 'rgba(var(--fg-rgb),0.05)',
            border: '1px solid rgba(var(--fg-rgb),0.1)',
            borderRadius: 'var(--r-12)',
            padding: '12px 14px',
            color: 'var(--text)',
            fontSize: 14,
            outline: 'none',
          }}
        />
      )}
    </div>
  );
}
