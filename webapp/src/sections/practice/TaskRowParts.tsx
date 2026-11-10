// Части строки задания (TaskRow, b20): строка меты под названием — срок, «от терапевта» со знаком Talk (вместо
// красной полосы и красной капители), статус только «Скоро срок» / «Просрочено»; кнопка «Готово» своего задания —
// круг 44 с галочкой в правой колонке (раньше кнопка с текстом уходила под текст, и строка рвалась на шесть строк).
import { useState } from 'react';
import type { UserTask } from '../../api';
import { fmtDate } from '../../utils/format';
import { SignArt } from '../../components/art/SignArt';
import { GlyphCheck } from '../../components/exercises/ExScreen';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import type { TaskStatus } from '../../../../shared/src/tasks/taskStatus';

export function TaskRowMeta({ task, from, status }: { task: UserTask; from: boolean; status: TaskStatus | null }) {
  if (!task.dueDate && !from && !status) return null;
  return (
    <div className="cp-task-meta">
      {task.dueDate && <span>до {fmtDate(task.dueDate)}</span>}
      {from && <span className="cp-task-from"><SignArt sign="talk" size="nav" />от терапевта</span>}
      {status && <TaskStatusBadge status={status} className="cp-task-status" />}
    </div>
  );
}

/** «Готово»: промис onComplete возвращает кнопку при сбое; слово — имя кнопки для чтения с экрана. */
export function TaskDoneButton({ onComplete }: { onComplete?: () => void | Promise<unknown> }) {
  const [completing, setCompleting] = useState(false);
  const complete = () => { setCompleting(true); void Promise.resolve(onComplete?.()).finally(() => setCompleting(false)); };
  return (
    <button
      type="button" className="cp-task-done" title="Готово"
      disabled={completing} aria-busy={completing || undefined}
      onClick={e => { e.stopPropagation(); complete(); }}
    >
      <GlyphCheck /><span className="cp-task-done-label">Готово</span>
    </button>
  );
}
