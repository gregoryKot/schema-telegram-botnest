// Группы полного списка заданий (AllTasksOverlay, b20): «От терапевта», «Мои цели», «Выполнено» — те же блоки
// и счётчики, что на «Практиках», а не одна лента вперемешку. «Выполнено» свёрнуто, пока есть активные: строки
// истории в DOM остаются (hidden) — раскрытие не перезапрашивает список, а смок «Выполнено» ищет строку и в
// свёрнутой группе (e2e-browser/support/clientTasks.ts). Строка истории — тихая: знак бледнее, под названием
// статус (тот же TaskStatusBadge, что у терапевта, здесь — без заливки) и дата одной строкой меты.
import { useState } from 'react';
import type { UserTask } from '../../api';
import { TaskRow } from '../practice/TaskRow';
import { TaskSign } from '../practice/TaskSign';
import type { TaskGroups } from '../practice/taskListModel';
import { GlyphChevron } from '../../components/exercises/ExGlyphs';
import { fmtDate, momentDayKey } from '../../utils/format';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { taskStatus } from '../../../../shared/src/tasks/taskStatus';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import { pluralRu as plural } from '../../../../shared/src/utils/pluralRu';
import { glueSpaces } from '../../../../shared/src/utils/typo';

interface Props {
  groups: TaskGroups;
  today: string;
  phone: boolean;
  onOpen: (task: UserTask) => void;
  onComplete: (task: UserTask) => void | Promise<unknown>;
}

export function TaskListGroups({ groups, today, phone, onOpen, onComplete }: Props) {
  const active = groups.therapist.length + groups.mine.length;
  // Хранится только явный выбор человека: «свёрнуто, пока есть активные» считается на каждом рендере —
  // отметил «Готово» у последнего активного, и история раскрывается сама, а не остаётся пустым заголовком.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const doneOpen = toggled ?? active === 0;
  const row = (t: UserTask, cta: string) => (
    <TaskRow key={t.id} task={t} mark={t.assignedBy !== null} compact={phone} cta={cta}
      status={taskStatus(t, today)} onOpen={() => onOpen(t)} onComplete={() => onComplete(t)} />
  );
  const n = groups.mine.length;
  return (
    <>
      {groups.therapist.length > 0 && (
        <section className="sk-group sk-task-group">
          <div className="ds-head-row">
            <h2 className="sk-group-title">От терапевта</h2>
            <span className="ds-sub">{groups.therapist.length} {plural(groups.therapist.length, 'задание', 'задания', 'заданий')}</span>
          </div>
          <div className="sk-list">{groups.therapist.map(t => row(t, 'начать →'))}</div>
        </section>
      )}
      {n > 0 && (
        <section className="sk-group sk-task-group">
          <div className="ds-head-row">
            <h2 className="sk-group-title">Мои цели</h2>
            <span className="ds-sub">{n} {plural(n, 'активная', 'активные', 'активных')}</span>
          </div>
          <div className="sk-list">{groups.mine.map(t => row(t, 'открыть →'))}</div>
        </section>
      )}
      {groups.done.length > 0 && (
        <section className="sk-group sk-task-group sk-done-group">
          <button type="button" className="sk-done-toggle" aria-expanded={doneOpen} onClick={() => setToggled(!doneOpen)}>
            <span className="sk-group-title">Выполнено</span>
            <span className="ds-sub">{groups.done.length}</span>
            <span className="sk-done-chev" aria-hidden="true"><GlyphChevron up={doneOpen} /></span>
          </button>
          <div className="sk-list" hidden={!doneOpen}>
            {groups.done.map(t => (
              <div key={t.id} className="ds-card ds-card--row sk-task is-past">
                <span className="pp-row-art"><TaskSign task={t} /></span>
                <div className="sk-task-main">
                  <div className="sk-task-text">{glueSpaces(resolveTaskDisplayText(t, 'compact'))}</div>
                  <div className="sk-task-meta">
                    <TaskStatusBadge status={taskStatus(t, today)} />
                    {t.completedAt && <span>{fmtDate(momentDayKey(t.completedAt))}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
