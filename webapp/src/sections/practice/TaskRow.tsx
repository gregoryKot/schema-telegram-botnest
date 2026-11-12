import { pressable } from '../../utils/a11y';
import type { UserTask } from '../../api';
import { TaskProgressBar } from '../../components/TaskProgressBar';
import { GlyphCheck } from '../../components/exercises/ExGlyphs';
import type { TaskStatus } from '../../../../shared/src/tasks/taskStatus';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import { taskRowState } from './taskRowState';
import { rowStatus } from './taskListModel';
import { TaskDoneButton, TaskRowMeta } from './TaskRowParts';
import { TaskSign } from './TaskSign';
import '../../styles/client-practice.css';

/** Строка задания/цели (b20): знак сущности слева, название (текст терапевта или клиента — glueSpaces), строка меты;
 *  справа одна колонка — шеврон/ссылка, круг «Готово» или залитая галочка «сделано сегодня» (без сдвига знака). */
export function TaskRow({ task, cta, mark, compact, status, onOpen, onComplete }: {
  task: UserTask; cta: string; mark?: boolean; compact?: boolean; status?: TaskStatus; onOpen: () => void;
  /** Закрыть цель без упражнения; промис нужен, чтобы вернуть кнопку при сбое. */
  onComplete?: () => void | Promise<unknown>;
}) {
  const st = taskRowState(task, !!onComplete);
  return (
    <div
      className={'ds-card ds-card--row ds-card--nav cp-task' + (st.openable ? ' ds-card--hover' : '') + (st.doneToday ? ' cp-task--done' : '')}
      {...(st.openable ? pressable(onOpen) : {})}
    >
      <span className="pp-row-art"><TaskSign task={task} /></span>
      <div className="cp-task-body">
        <div className="cp-task-title">{glueSpaces(resolveTaskDisplayText(task, 'compact'))}</div>
        {st.streakNote && <div className="cp-task-note">Сделано сегодня — завтра снова</div>}
        <TaskProgressBar task={task} />
        <TaskRowMeta task={task} from={!!mark && !st.doneToday} status={rowStatus(status)} />
      </div>
      {st.showComplete && <TaskDoneButton onComplete={onComplete} />}
      {st.doneToday && <span className="cp-task-check" aria-hidden="true"><GlyphCheck /></span>}
      {st.showCta && (compact ? <span className="ds-chev" aria-hidden="true" /> : <span className="ds-link">{cta}</span>)}
    </div>
  );
}
