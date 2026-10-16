import { OverlayFrame } from '../../components/OverlayFrame';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import type { UserTask } from '../../api';
import { pressable } from '../../utils/a11y';
import { fmtDate } from '../../utils/format';
import { resolveTaskText } from './exerciseLibrary';

export function AllGoalsOverlay({ tasks, taskHistory, onClose, onOpen, onAdd }: {
  tasks: UserTask[]; taskHistory: UserTask[];
  onClose: () => void; onOpen: (t: UserTask) => void; onAdd: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  return (
    <OverlayFrame title="Все цели" onBack={goBack}>
      <div className="sk-list">
        {tasks.map(t => (
          <div key={t.id} className="ds-card ds-card--row ds-card--hover sk-task" {...pressable(() => onOpen(t))}>
            <div className="sk-task-main">
              <div className="sk-task-text">{resolveTaskText(t)}</div>
              {t.dueDate && <div className="ds-sub">до {fmtDate(t.dueDate)}</div>}
            </div>
            <span className="ds-link">открыть →</span>
          </div>
        ))}
      </div>
      {taskHistory.length > 0 && (
        <div className="sk-group">
          <div className="ds-label">Выполнено</div>
          <div className="sk-list">
            {taskHistory.map(t => (
              <div key={t.id} className="ds-card ds-card--row sk-task is-past">
                <div className="sk-task-main"><div className="sk-task-text">{resolveTaskText(t)}</div></div>
                <span className="ds-sub">{t.done === true ? 'готово' : 'отменено'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button className="ds-btn sk-wide-btn" onClick={onAdd}>
        + Поставить цель
      </button>
    </OverlayFrame>
  );
}
