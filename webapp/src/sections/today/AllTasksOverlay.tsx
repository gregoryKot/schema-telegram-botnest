import type { UserTask } from '../../api';
import { OverlayFrame } from '../../components/OverlayFrame';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import { useIsMobile } from '../../components/useIsMobile';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { fmtDate, momentDayKey, todayStr } from '../../utils/format';
import { TaskRow } from '../practice/TaskRow';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { taskStatus } from '../../../../shared/src/tasks/taskStatus';

interface Props {
  /** «Все задания» на «Сегодня», «Все цели» в «Практике». */
  title: string;
  tasks: UserTask[];
  taskHistory: UserTask[];
  onClose: () => void;
  /** Тот же маршрут, что у строки экрана (useTaskLauncher.openTask). */
  onOpen: (task: UserTask) => void;
  onComplete: (task: UserTask) => void | Promise<unknown>;
  onAdd: () => void;
}

// Полный список заданий — один на «Сегодня» и «Практику» (раньше два оверлея:
// AllTasksOverlay и AllGoalsOverlay). QA 2026-11 (A-З8): в «Все задания» у
// заданий не было ни кнопки, ни нажатия — список был тупиком, а статус
// показывала одинокая точка «·». Теперь строка — общий TaskRow (открывает
// задание, у «Своего задания» — «Готово»), статус — бейдж из shared/taskStatus.
// Открыть задание и «+ Поставить цель» — сначала снять свою запись истории
// (goBack(then)): трекер и дневники лежат ниже оверлея (z-index 80 < 200).
export function AllTasksOverlay({ title, tasks, taskHistory, onClose, onOpen, onComplete, onAdd }: Props) {
  const goBack = useHistorySheet(onClose);
  const phone = useIsMobile();
  // Местный день человека: с ним сравнивается срок, который поставил терапевт (№25).
  const today = todayStr();
  return (
    <OverlayFrame title={title} onBack={goBack}>
      <div className="sk-list">
        {tasks.map(t => (
          <TaskRow
            key={t.id} task={t} mark={t.assignedBy !== null} compact={phone}
            cta={t.assignedBy !== null ? 'начать →' : 'открыть →'}
            status={taskStatus(t, today)}
            onOpen={() => goBack(() => onOpen(t))}
            onComplete={() => onComplete(t)}
          />
        ))}
      </div>
      {taskHistory.length > 0 && (
        <div className="sk-group">
          <div className="ds-label">Выполнено</div>
          <div className="sk-list">
            {taskHistory.map(t => (
              <div key={t.id} className="ds-card ds-card--row sk-task is-past">
                <div className="sk-task-main">
                  <div className="sk-task-text">{resolveTaskDisplayText(t, 'compact')}</div>
                  {t.completedAt && <div className="ds-sub">{fmtDate(momentDayKey(t.completedAt))}</div>}
                </div>
                <TaskStatusBadge status={taskStatus(t, today)} />
              </div>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="ds-btn sk-wide-btn" onClick={() => goBack(onAdd)}>
        + Поставить цель
      </button>
    </OverlayFrame>
  );
}
