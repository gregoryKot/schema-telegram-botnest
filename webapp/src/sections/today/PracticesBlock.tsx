import type { UserTask } from '../../api';
import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { taskStatusMark } from './helpers';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';

interface Props {
  /** Заголовок блока: «От терапевта», если среди заданий есть назначенные терапевтом. */
  title: string;
  tasks: UserTask[];
  taskError: boolean;
  onStart: (task: UserTask) => void;
  onShowAll: () => void;
  onAddGoal: () => void;
}

// Задания на сегодня: карточки-задачи; у заданий терапевта — метка «от терапевта».
export function PracticesBlock({ title, tasks, taskError, onStart, onShowAll, onAddGoal }: Props) {
  const tr = useTr();
  const activeCount = tasks.filter(t => t.done === null).length;
  return (
    <section className="ct-section ct-block">
      <div className="ds-head-row">
        <h3 className="ds-h2">{title}</h3>
        {activeCount > 0 && <span className="ds-sub">{activeCount} активных</span>}
      </div>
      {taskError && (
        <div role="alert" className="ct-alert">
          {tr(
            'Не удалось сохранить изменение задания. Проверь соединение и попробуй ещё раз',
            'Не удалось сохранить изменение задания. Проверьте соединение и попробуйте ещё раз',
          )}
        </div>
      )}
      {tasks.slice(0, 5).map(task => {
        const isDone = task.done === true;
        const active = task.done === null;
        return (
          <div
            key={task.id}
            className={'ds-card ds-card--row ct-task' + (active ? ' ds-card--hover' : '') + (isDone ? ' is-done' : '')}
            {...(active ? pressable(() => onStart(task)) : {})}
          >
            <span className="ct-task-box" aria-hidden>{active ? '' : taskStatusMark(task.done)}</span>
            <div className="ct-task-body">
              <div className="ct-task-text">{resolveTaskDisplayText(task, 'compact')}</div>
              {task.assignedBy !== null && !isDone && <div className="ct-from-therapist">от терапевта</div>}
            </div>
            {active && <span className="ct-task-cta">начать →</span>}
          </div>
        );
      })}
      {tasks.length > 5 && (
        <button type="button" onClick={onShowAll} className="ds-link ct-more">Все задания ({tasks.length}) →</button>
      )}
      <button type="button" onClick={onAddGoal} className="ct-add-goal">+ Поставить цель</button>
    </section>
  );
}
