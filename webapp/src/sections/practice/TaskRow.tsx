import { pressable } from '../../utils/a11y';
import { fmtDate } from '../../utils/format';
import type { UserTask } from '../../api';
import { TaskProgressBar } from '../../components/TaskProgressBar';
import { resolveTaskText } from './exerciseLibrary';

/** Строка задания/цели: название, срок, действие справа. */
export function TaskRow({ task, cta, mark, onOpen }: {
  task: UserTask; cta: string; mark?: boolean; onOpen: () => void;
}) {
  return (
    <div className="ds-card ds-card--row ds-card--hover cp-task" {...pressable(onOpen)}>
      {mark && <span className="cp-task-bar" />}
      <div className="cp-task-body">
        {mark && <div className="ds-label cp-task-from">от терапевта</div>}
        <div className="cp-task-title">{resolveTaskText(task)}</div>
        <TaskProgressBar task={task} />
        {task.dueDate && <div className="ds-sub">до {fmtDate(task.dueDate)}</div>}
      </div>
      <span className="ds-link">{cta}</span>
    </div>
  );
}
