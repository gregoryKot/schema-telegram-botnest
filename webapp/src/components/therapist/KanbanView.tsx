import type { CSSProperties } from 'react';
import type { UserTask, UserId } from '../../api';
import { todayStr } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import { Skeleton } from '../Skeleton';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import { STATUS_LABEL, isOpenStatus, orderTasks, taskMeta, taskStatus } from './taskModel';
import { TaskStatusBadge } from '../TaskStatusBadge';
import { TaskSign } from '../../sections/practice/TaskSign';
import { SignArt } from '../art/SignArt';
import { PaperAlert } from '../paper/PaperAlert';
import { BOARD_COLUMN_LOOK } from './cabinetLook';
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
        {Object.values(BOARD_COLUMN_LOOK).map(look => (
          <div key={look.hue} className="pp-paper tc-kcol" style={{ '--h': look.hue } as CSSProperties}>
            <Skeleton width="40%" height={12} />
            <Skeleton height={76} radius={12} />
            <Skeleton height={76} radius={12} />
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
    { key: 'done', label: 'Выполнено', items: flat.filter(t => t.status === 'done') },
    { key: 'failed', label: STATUS_LABEL.failed, items: flat.filter(t => t.status === 'failed') },
  ] as const;

  // Колонка — бумага статуса (BOARD_COLUMN_LOOK); карточка — светлый лист, знак типа (TaskSign) — в строке имени
  // клиента, текст во всю ширину (r1); статус — тот же ярлык бумаги (TaskStatusBadge paper), что во вкладке «Задания».
  return (
    <div className="tc-kanban">
      {cols.map(col => {
        const look = BOARD_COLUMN_LOOK[col.key];
        return (
          <section key={col.key} className="pp-paper tc-kcol" style={{ '--h': look.hue } as CSSProperties} aria-label={col.label}>
            <div className="tc-kcol-head">
              <span className="ds-label">{col.label}</span>
              {col.items.length > 0 && <span className="tc-kcol-count">{col.items.length}</span>}
              {'sign' in look && <span className="tc-kcol-sign" aria-hidden="true"><SignArt sign={look.sign} size="row" /></span>}
            </div>
            {col.items.length === 0 && <div className="tc-dash">–</div>}
            {col.items.map(task => (
              <div key={task.id} className="tc-task" {...pressable(() => onOpenClient(task.userId))}>
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
          </section>
        );
      })}
    </div>
  );
}
