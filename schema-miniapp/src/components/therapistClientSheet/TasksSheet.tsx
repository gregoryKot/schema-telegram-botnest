import { BottomSheet } from '../BottomSheet';
import { api } from '../../api';
import { todayStr } from '../../utils/format';
import { orderTasks } from '../../../../shared/src/tasks/taskStatus';
import { useConfirmTap } from '../../hooks/useConfirmTap';
import {
  therapistClosesTask,
  useTherapistTaskActions,
} from '../../../../shared/src/therapy/useTherapistTaskActions';
import { ClientDetail } from './types';
import { TaskSheetRow } from './TaskSheetRow';
import { ConfirmDeleteButton } from '../ConfirmDeleteButton';

interface TasksSheetProps {
  detail: ClientDetail;
}

export function TasksSheet({ detail }: TasksSheetProps) {
  const { clientTasks, setClientTasks, setShowTasksSheet, setShowAssign } =
    detail;
  const today = todayStr();
  // Удаление (два тапа) и отметка задания офлайн-клиента — общая с сайтом
  // механика (QA 2026-10-26: задание нельзя было удалить).
  const actions = useTherapistTaskActions(api, setClientTasks);
  const { tap: tapDelete, isPending } = useConfirmTap<number>(
    (id) => void actions.remove(id),
  );

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
                actions={
                  <>
                    {therapistClosesTask(task) && (
                      <button
                        onClick={() => void actions.markDone(task.id)}
                        disabled={actions.busyId === task.id}
                        style={{
                          flexShrink: 0,
                          minHeight: 44,
                          padding: '0 12px',
                          borderRadius: 'var(--r-10)',
                          border: '1px solid rgba(var(--fg-rgb),0.12)',
                          background: 'transparent',
                          color: 'var(--text)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Выполнено
                      </button>
                    )}
                    <ConfirmDeleteButton
                      pending={isPending(task.id)}
                      onTap={() => tapDelete(task.id)}
                      label="Удалить задание"
                      disabled={actions.busyId === task.id}
                    />
                  </>
                }
              />
            ))
          )}
        </div>
        {actions.error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: 'var(--accent-red)',
              marginBottom: 12,
            }}
          >
            {actions.error}
          </div>
        )}
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
