import type { UserTask, UserId } from '../../api';
import { todayStr } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import { Skeleton, SkeletonLines } from '../Skeleton';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { STATUS_LABEL, isOpenStatus, orderTasks, taskMeta, taskStatus } from './taskModel';
import { TaskStatusBadge } from '../TaskStatusBadge';
import { TaskSign } from '../../sections/practice/TaskSign';
import { SignArt } from '../art/SignArt';
import { PaperAlert } from '../paper/PaperAlert';
import '../../styles/therapist-clients.css';

interface Props {
  allTasks: { clientId: UserId; clientName: string; tasks: UserTask[] }[] | null;
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  onOpenClient: (clientId: UserId) => void;
}

export function KanbanView({ allTasks, loading, loadFailed, onRetry, onOpenClient }: Props) {
  if (loadFailed) {
    // Сбой ≠ пусто (иначе — пустая доска вместо ошибки). Знак — Cluster, как у сбоев «Сегодня» и «Клиентов» (r1).
    return <PaperAlert sign="cluster" title="Не удалось загрузить задания" onRetry={onRetry} retryLabel="Попробовать ещё раз" />;
  }
  if (loading || !allTasks) {
    return (
      <div className="tc-kanban" aria-hidden>
        {[0, 1, 2].map(i => (
          <div key={i} className="tc-kcol">
            <Skeleton width="40%" height={12} />
            <div className="ds-rows">
              {[0, 1].map(r => <div key={r} className="tc-task-skel"><SkeletonLines widths={['35%', '90%', '30%']} /></div>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Колонки — по модели статусов карточки (taskModel): «Не вышло» на доске = «Не вышло» в карточке.
  const today = todayStr();
  const flat = orderTasks(
    allTasks.flatMap(group => group.tasks.map(t => ({ ...t, clientName: group.clientName }))),
    today,
  ).map(t => ({ ...t, status: taskStatus(t, today) }));
  if (flat.length === 0) {
    // Пустая доска — знак заданий и строка (сцена кабинета — про «нет клиентов», здесь не нужна).
    return (
      <div className="tc-board-empty">
        <span className="tc-block-sign" aria-hidden="true"><SignArt sign="check" size="row" /></span>
        <p className="ds-empty">Назначенных заданий пока нет</p>
      </div>
    );
  }

  const cols = [
    { key: 'open', label: 'Назначено', items: flat.filter(t => isOpenStatus(t.status)) },
    { key: 'done', label: 'Выполнено', items: flat.filter(t => t.status === 'done'), sign: 'check' as const },
    { key: 'failed', label: STATUS_LABEL.failed, items: flat.filter(t => t.status === 'failed') },
  ] as const;

  // Группа — eyebrow с линией, задания — строки на бумаге между линиями (К30); знак типа (TaskSign) — в строке
  // имени клиента; статус — тот же ярлык бумаги (TaskStatusBadge paper), что во вкладке «Задания» карточки.
  return (
    <div className="tc-kanban">
      {cols.map(col => (
        <section key={col.key} className="tc-kcol" aria-label={col.label}>
          <div className="tc-kcol-head">
            <span className="ds-label">{col.label}</span>
            {col.items.length > 0 && <span className="tc-kcol-count">{col.items.length}</span>}
            {'sign' in col && <span className="tc-kcol-sign" aria-hidden="true"><SignArt sign={col.sign} size="row" /></span>}
          </div>
          <div className="ds-rows">
            {col.items.length === 0 && <div className="tc-dash">–</div>}
            {col.items.map(task => (
              <div key={task.id} className="ds-list-row ds-list-row--hover tc-task" {...pressable(() => onOpenClient(task.userId))}>
                <div className="tc-task-head">
                  <span className="tc-task-sign" aria-hidden="true"><TaskSign task={task} /></span>
                  <span className="tc-task-client">{task.clientName}</span>
                </div>
                <div className="tc-task-text">{resolveTaskDisplayText(task, 'full')}</div>
                <div className="tc-task-meta">
                  <span className="tc-task-due">{taskMeta(task, task.status)}</span>
                  {(task.status === 'overdue' || task.status === 'soon') && <TaskStatusBadge status={task.status} paper />}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
