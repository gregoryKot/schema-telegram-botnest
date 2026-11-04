import type { TaskStatus } from '../../../shared/src/tasks/taskStatus';
import { STATUS_BADGE, STATUS_LABEL } from './therapist/taskModel';

/**
 * Бейдж статуса задания — один на сайт: карточка клиента и доска терапевта,
 * «Все задания» и «Все цели» клиента. Статус считает shared/src/tasks/taskStatus.
 */
export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={className ? `${STATUS_BADGE[status]} ${className}` : STATUS_BADGE[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}
