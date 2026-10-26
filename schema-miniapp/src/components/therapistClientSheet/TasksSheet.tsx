import { BottomSheet } from '../BottomSheet';
import { todayStr } from '../../utils/format';
import { orderTasks } from '../../../../shared/src/tasks/taskStatus';
import { ClientDetail } from './types';
import { TaskSheetRow } from './TaskSheetRow';

interface TasksSheetProps {
  detail: ClientDetail;
}

export function TasksSheet({ detail }: TasksSheetProps) {
  const { clientTasks, setShowTasksSheet, setShowAssign } = detail;
  const today = todayStr();

  return (
    <BottomSheet onClose={() => setShowTasksSheet(false)}>
      <div className="u-pt4">
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          Задания
        </div>
        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.03)',
            border: '1px solid rgba(var(--fg-rgb),0.07)',
            borderRadius: 'var(--r-16)',
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          {clientTasks.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                fontSize: 13,
                color: 'var(--text-sub)',
                textAlign: 'center',
              }}
            >
              Нет назначенных заданий
            </div>
          ) : (
            orderTasks(clientTasks, today).map((task, i) => (
              <TaskSheetRow
                key={task.id}
                task={task}
                today={today}
                first={i === 0}
              />
            ))
          )}
        </div>
        <button
          onClick={() => setShowAssign(true)}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 'var(--r-14)',
            border: 'none',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Назначить задание
        </button>
      </div>
    </BottomSheet>
  );
}
