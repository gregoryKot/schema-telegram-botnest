import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import { fmtDate } from '../../utils/format';
import type { UserTask } from '../../api';
import { TaskProgressBar } from '../../components/TaskProgressBar';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import type { TaskStatus } from '../../../../shared/src/tasks/taskStatus';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { taskRowState } from './taskRowState';
import { TaskSign } from './TaskSign';
import '../../styles/client-practice.css';

/** Строка задания/цели: название, срок, действие справа; в полном списке — бейдж статуса. */
export function TaskRow({ task, cta, mark, compact, status, onOpen, onComplete }: {
  task: UserTask; cta: string; mark?: boolean; compact?: boolean; status?: TaskStatus; onOpen: () => void;
  /** Закрыть цель без упражнения; промис нужен, чтобы вернуть кнопку при сбое. */
  onComplete?: () => void | Promise<unknown>;
}) {
  const [completing, setCompleting] = useState(false);
  const st = taskRowState(task, !!onComplete);
  const complete = () => { setCompleting(true); void Promise.resolve(onComplete?.()).finally(() => setCompleting(false)); };
  return (
    <div
      className={'ds-card ds-card--row ds-card--nav cp-task' + (st.openable ? ' ds-card--hover' : '') + (st.doneToday ? ' cp-task--done' : '')}
      {...(st.openable ? pressable(onOpen) : {})}
    >
      {mark && !st.doneToday && <span className="cp-task-bar" />}
      {st.doneToday && <span className="cp-task-check" aria-hidden="true">✓</span>}
      <span className="pp-row-art"><TaskSign task={task} /></span>
      <div className="cp-task-body">
        {mark && !st.doneToday && <div className="ds-label cp-task-from">от терапевта</div>}
        <div className="cp-task-title">{resolveTaskDisplayText(task, 'compact')}</div>
        {st.streakNote && <div className="cp-task-note">Сделано сегодня — завтра снова</div>}
        <TaskProgressBar task={task} />
        {task.dueDate && <div className="ds-sub">до {fmtDate(task.dueDate)}</div>}
        {status && <TaskStatusBadge status={status} className="cp-task-status" />}
      </div>
      {st.showComplete && (
        <button
          className="ds-btn ds-btn--sm ds-btn--secondary"
          disabled={completing} aria-busy={completing || undefined}
          onClick={e => { e.stopPropagation(); complete(); }}
        >
          {completing ? '...' : 'Готово'}
        </button>
      )}
      {st.showCta && (compact ? <span className="ds-chev" aria-hidden="true" /> : <span className="ds-link">{cta}</span>)}
    </div>
  );
}
