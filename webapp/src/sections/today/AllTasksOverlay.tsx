import type { UserTask } from '../../api';
import { OverlayFrame } from '../../components/OverlayFrame';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { fmtDate, momentDayKey } from '../../utils/format';
import { TaskProgressBar } from '../../components/TaskProgressBar';
import { taskStatusMark } from './helpers';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';

// Оверлей «Все задания» экрана «Сегодня». Вынесено из TodaySection.tsx
// (правило №10). Поведение не менялось.
export function AllTasksOverlay({ tasks, taskHistory, onClose, onTaskDone, onAddTask }: {
  tasks: UserTask[];
  taskHistory: UserTask[];
  onClose: () => void;
  onTaskDone: (id: number) => void;
  onAddTask: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  return (
    <OverlayFrame title="Все задания" onBack={goBack}>
      <div className="sk-list">
        {tasks.map(task => (
          <div key={task.id} className="ds-card ds-card--row sk-task">
            <span className="sk-task-mark">{taskStatusMark(task.done)}</span>
            <div className="sk-task-main">
              {task.assignedBy !== null && <div className="ds-eyebrow">от терапевта</div>}
              <div className="sk-task-text">{resolveTaskDisplayText(task, 'compact')}</div>
              <TaskProgressBar task={task} />
              {task.dueDate && <div className="ds-sub">до {fmtDate(task.dueDate)}</div>}
            </div>
            {task.done === null && task.type === 'custom' && (
              <button onClick={() => onTaskDone(task.id as number)} className="ds-btn ds-btn--sm ds-btn--secondary">
                Готово
              </button>
            )}
          </div>
        ))}
      </div>
      {taskHistory.length > 0 && (
        <div className="sk-group">
          <div className="ds-label">Выполнено</div>
          <div className="sk-list">
            {taskHistory.map(task => (
              <div key={task.id} className="ds-card ds-card--row sk-task is-past">
                <span className="sk-task-mark">{taskStatusMark(task.done)}</span>
                <div className="sk-task-main">
                  <div className="sk-task-text">{resolveTaskDisplayText(task, 'compact')}</div>
                  {task.completedAt && <div className="ds-sub">{fmtDate(momentDayKey(task.completedAt))}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={onAddTask} className="ds-btn sk-wide-btn">
        + Поставить цель
      </button>
    </OverlayFrame>
  );
}
