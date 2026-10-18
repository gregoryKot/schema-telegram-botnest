// Лист «что показывать в плюсе»: тумблер на каждое действие. Хранение и
// ключи — общие с мини-аппом (shared/src/quickActions/quickActionPrefs).
// Порядок сайт читает из той же настройки, но менять пока не умеет.
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { api } from '../../api';
import { BottomSheetShell } from '../BottomSheetShell';
import { makeQuickActionRowHandlers } from '../../../../shared/src/quickActions/quickActionRowHandlers';
import type { QuickActionGroup } from '../../../../shared/src/quickActions/quickActions';
import '../../styles/quick-actions.css';

interface Props {
  groups: QuickActionGroup[];
  hidden: string[];
  onToggle: (id: string, hidden: boolean) => void;
  onClose: () => void;
}

export function QuickActionCustomizeSheet({ groups, hidden, onToggle, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const { handleToggle } = makeQuickActionRowHandlers(
    'plus',
    onToggle,
    () => false,
    api,
  );
  return (
    <BottomSheetShell goBack={goBack} zIndex={260} label="Что показывать в плюсе">
      <div className="ds-h3">Что показывать в «+»</div>
      <div className="ds-sub qa-empty">Скрытые пункты можно вернуть в любой момент</div>
      {groups.map((g) => (
        <div key={g.id} className="qa-group">
          <div className="ds-label qa-group-title">{g.title}</div>
          {g.actions.map((a) => {
            const wasHidden = hidden.includes(a.id);
            return (
              <div key={a.id} className="qa-custom-row">
                <span className="qa-custom-text">
                  <span className="qa-row-label">{a.label}</span>
                  <span className="qa-row-sub">{a.sub}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!wasHidden}
                  aria-label={a.label}
                  className="ds-switch"
                  onClick={() => handleToggle(a.id, wasHidden)}
                >
                  <span className="ds-switch-knob" />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </BottomSheetShell>
  );
}
