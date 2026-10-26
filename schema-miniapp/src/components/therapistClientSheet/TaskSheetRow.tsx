import type { ReactNode } from 'react';
import { resolveTaskDisplayText } from '../../../../shared/src/tasks/taskTitle';
import {
  STATUS_LABEL,
  taskMeta,
  taskStatus,
} from '../../../../shared/src/tasks/taskStatus';
import type { ClientDetail } from './types';

type Task = ClientDetail['clientTasks'][number];

// Строка задания в листе «Задания» кабинета: статус, название, подпись.
// Статус и подпись — общая модель с сайтом (shared/tasks/taskStatus): «не
// вышло» не выдаётся за «в работе», у выполненного — дата выполнения, у
// серии — «1 из 7 дней» (полоса «3/5» отсюда ушла: число теперь в подписи).
// Вынесено из TasksSheet.tsx (правило №10).
const markOf = (t: Task, failed: boolean) =>
  t.done === true || t.doneToday ? '✓' : failed ? '×' : '·';
// Иконка-глиф '✓'/'×'/'·' не несёт смысла для скринридера — подписываем.
const labelOf = (t: Task, failed: boolean) =>
  t.done === true || t.doneToday
    ? STATUS_LABEL.done
    : failed
      ? STATUS_LABEL.failed
      : 'Ожидает выполнения';

export function TaskSheetRow({
  task,
  today,
  first,
  actions,
}: {
  task: Task;
  today: string;
  first: boolean;
  /** Кнопки справа (удалить, отметить выполненным). */
  actions?: ReactNode;
}) {
  const status = taskStatus(task, today);
  const failed = status === 'failed';
  const mark = markOf(task, failed);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-10)',
        padding: '12px 16px',
        borderTop: first ? undefined : '1px solid rgba(var(--fg-rgb),0.05)',
      }}
    >
      <span
        aria-label={labelOf(task, failed)}
        style={{
          fontSize: 16,
          flexShrink: 0,
          marginTop: 1,
          color: failed
            ? 'var(--text-faint)'
            : mark === '✓'
              ? 'var(--text)'
              : undefined,
        }}
      >
        {mark}
      </span>
      <div className="u-fill">
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>
          {resolveTaskDisplayText(task, 'full')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3 }}>
          {taskMeta(task, status)}
        </div>
      </div>
      {actions}
    </div>
  );
}
