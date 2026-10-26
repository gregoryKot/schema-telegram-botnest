import { useState } from 'react';
import type { UserTask } from '../../api';
import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { taskStatusMark } from './helpers';
import { taskRowState } from '../practice/taskRowState';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';

interface Props {
  /** Заголовок блока: «От терапевта», если среди заданий есть назначенные терапевтом. */
  title: string;
  tasks: UserTask[];
  taskError: boolean;
  onStart: (task: UserTask) => void;
  /** «Готово» у своего задания; промис нужен, чтобы вернуть кнопку при сбое. */
  onComplete: (task: UserTask) => void | Promise<unknown>;
  onShowAll: () => void;
  onAddGoal: () => void;
}

// Задания на сегодня: карточки-задачи; у заданий терапевта — метка «от терапевта».
// Тап открывает упражнение задания; у «Своего задания» вместо стрелки «Готово»
// (QA 2026-10-26: тап по нему не делал ничего, и задание навсегда оставалось
// «В работе», если всего заданий не больше пяти и ссылки «Все задания» нет).
export function PracticesBlock({ title, tasks, taskError, onStart, onComplete, onShowAll, onAddGoal }: Props) {
  const tr = useTr();
  const [completing, setCompleting] = useState<number | null>(null);
  const activeCount = tasks.filter(t => t.done === null).length;
  const complete = (task: UserTask) => {
    setCompleting(task.id);
    void Promise.resolve(onComplete(task)).finally(() => setCompleting(null));
  };
  return (
    <section className="ct-section ct-block">
      <div className="ds-head-row">
        <h3 className="ds-h2">{title}</h3>
        {activeCount > 0 && <span className="ds-sub">{activeCount} {pluralRu(activeCount, 'активная', 'активных', 'активных')}</span>}
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
        const st = taskRowState(task, true);
        const openable = active && st.openable;
        return (
          <div
            key={task.id}
            className={'ds-card ds-card--row ct-task' + (openable ? ' ds-card--hover' : '') + (isDone ? ' is-done' : '')}
            {...(openable ? pressable(() => onStart(task)) : {})}
          >
            <span className="ct-task-box" aria-hidden>{active ? '' : taskStatusMark(task.done)}</span>
            <div className="ct-task-body">
              <div className="ct-task-text">{resolveTaskDisplayText(task, 'compact')}</div>
              {task.assignedBy !== null && !isDone && <div className="ct-from-therapist">от терапевта</div>}
            </div>
            {openable && <span className="ct-task-cta">начать →</span>}
            {st.showComplete && (
              <button
                type="button"
                className="ds-btn ds-btn--sm ds-btn--secondary"
                disabled={completing === task.id}
                onClick={() => complete(task)}
              >
                {completing === task.id ? '...' : 'Готово'}
              </button>
            )}
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
