import type { UserTask, UserId } from '../../api';
import { fmtDate } from '../../utils/format';
import { pressable } from '../../utils/a11y';
import { Skeleton } from '../Skeleton';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
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
    // Сбой ≠ пусто: без этой ветки отказ запроса рисовал бы терапевту
    // пустую доску («Назначенных заданий пока нет») вместо явной ошибки.
    return (
      <div role="alert" className="tc-alert">
        <p>Не удалось загрузить задания</p>
        <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onRetry}>Попробовать ещё раз</button>
      </div>
    );
  }
  if (loading || !allTasks) {
    return (
      <div className="tc-kanban" aria-hidden>
        {[0, 1, 2].map(i => (
          <div key={i} className="tc-kcol">
            <Skeleton width="40%" height={12} />
            <Skeleton height={76} radius={12} />
            <Skeleton height={76} radius={12} />
          </div>
        ))}
      </div>
    );
  }

  const flat = allTasks.flatMap(group =>
    group.tasks.map(t => ({ ...t, clientName: group.clientName }))
  );

  if (flat.length === 0) {
    return <div className="tc-empty">Назначенных заданий пока нет</div>;
  }

  const cols: { label: string; items: typeof flat; badge: string; name: string }[] = [
    { label: 'Назначено', items: flat.filter(t => t.done === null), badge: 'ds-badge ds-badge--accent', name: 'tc-task-client' },
    { label: 'Выполнено', items: flat.filter(t => t.done === true), badge: 'ds-badge ds-badge--ok', name: 'tc-task-client tc-task-client--ok' },
    { label: 'Не вышло', items: flat.filter(t => t.done === false), badge: 'ds-badge ds-badge--warn', name: 'tc-task-client tc-task-client--err' },
  ];

  return (
    <div className="tc-kanban">
      {cols.map(col => (
        <div key={col.label}>
          <div className="tc-kcol-head">
            <span className="ds-label">{col.label}</span>
            {col.items.length > 0 && <span className={col.badge}>{col.items.length}</span>}
          </div>
          <div className="tc-kcol">
            {col.items.length === 0 && <div className="tc-dash">–</div>}
            {col.items.map(task => (
              <div key={task.id} className="ds-card ds-card--hover tc-task" {...pressable(() => onOpenClient(task.userId))}>
                <div className={col.name}>{task.clientName}</div>
                <div className="tc-task-text">{resolveTaskDisplayText(task, 'full')}</div>
                {task.dueDate && <div className="tc-task-due">до {fmtDate(task.dueDate)}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
