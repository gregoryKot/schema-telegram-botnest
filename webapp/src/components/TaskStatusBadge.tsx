import type { CSSProperties } from 'react';
import type { TaskStatus } from '../../../shared/src/tasks/taskStatus';
import { STATUS_BADGE, STATUS_LABEL, STATUS_TAG } from './therapist/taskModel';

/**
 * Бейдж статуса задания — один на сайт: карточка клиента и доска терапевта,
 * «Все задания» и «Все цели» клиента. Статус считает shared/src/tasks/taskStatus.
 * `paper` — тихий ярлык на бумаге статуса (.pp-tag, STATUS_TAG) вместо цветной таблетки
 * (вкладка «Задания» карточки клиента у терапевта, b31).
 */
export function TaskStatusBadge({ status, className, paper }: { status: TaskStatus; className?: string; paper?: boolean }) {
  if (paper) {
    const tag = STATUS_TAG[status];
    const cls = `pp-tag${tag.strong ? ' is-strong' : ''}${className ? ` ${className}` : ''}`;
    return <span className={cls} data-status={status} style={{ '--h': tag.hue } as CSSProperties}>{STATUS_LABEL[status]}</span>;
  }
  return (
    <span className={className ? `${STATUS_BADGE[status]} ${className}` : STATUS_BADGE[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}
