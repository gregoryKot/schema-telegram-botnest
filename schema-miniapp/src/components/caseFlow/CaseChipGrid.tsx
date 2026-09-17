import type { CaseChip } from '../../../../shared/src/case/caseBodyChips';
import { isOwnChipId } from '../../../../shared/src/case/useCaseOwnSync';

/**
 * Шаги body/impulse: поле «своё» + чипы-варианты — общий примитив (правило
 * «одна механика — один компонент»: без него оба шага писали бы одну и ту же
 * раскладку дважды, как раньше случилось с оценкой потребности — CLAUDE.md).
 *
 * Поле рендерится ВСЕГДА и ПЕРВЫМ (фидбек владельца 2026-08-31: «по
 * умолчанию поле ввода, а снизу варианты»), чипы `*_own` («Своё…») из
 * контент-банков не рендерятся вовсе: их id живёт только в selectedIds и
 * поддерживается автосинхронизацией useCaseOwnSync по непустому тексту.
 * Максимум выбора и плейсхолдер держит вызывающий экран. Стиль пилюль — тот
 * же, что у SchemaPicker.tsx («тёплая бумага»), сам компонент не подходит:
 * он жёстко привязан к доменам схем.
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
        style={{
          marginBottom: 'var(--space-12)',
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
        {chips
          .filter((chip) => !isOwnChipId(chip.id))
          .map((chip) => {
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
    </div>
  );
}
