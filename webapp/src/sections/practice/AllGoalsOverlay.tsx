import { OverlayFrame } from '../../components/OverlayFrame';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import type { UserTask } from '../../api';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { TaskRow } from './TaskRow';

export function AllGoalsOverlay({ tasks, taskHistory, onClose, onOpen, onComplete, onAdd }: {
  tasks: UserTask[]; taskHistory: UserTask[];
  onClose: () => void; onOpen: (t: UserTask) => void;
  onComplete: (t: UserTask) => void | Promise<unknown>; onAdd: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  return (
    <OverlayFrame title="Все цели" onBack={goBack}>
      <div className="sk-list">
        {tasks.map(t => (
          <TaskRow key={t.id} task={t} mark={t.assignedBy !== null} cta="открыть →"
            onOpen={() => onOpen(t)} onComplete={() => onComplete(t)} />
        ))}
      </div>
      {taskHistory.length > 0 && (
        <div className="sk-group">
          <div className="ds-label">Выполнено</div>
          <div className="sk-list">
            {taskHistory.map(t => (
              <div key={t.id} className="ds-card ds-card--row sk-task is-past">
                <div className="sk-task-main"><div className="sk-task-text">{resolveTaskDisplayText(t, 'compact')}</div></div>
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
