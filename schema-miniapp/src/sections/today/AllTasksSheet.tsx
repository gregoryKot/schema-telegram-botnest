// AllTasksSheet — full task list + history sheet for TodaySection

import { api, UserTask } from '../../api';
import { BottomSheet } from '../../components/BottomSheet';
import { fmtDate } from '../../utils/format';
import {
  resolveTaskDisplayText,
  resolveTaskEmoji,
  TaskProgressBar,
} from './taskHelpers';

export function AllTasksSheet({
  tasks,
  taskHistory,
  onClose,
  setTasks,
  setTaskHistory,
  onOpenCreate,
}: {
  tasks: UserTask[];
  taskHistory: UserTask[];
  onClose: () => void;
  setTasks: (t: UserTask[]) => void;
  setTaskHistory: (t: UserTask[]) => void;
  onOpenCreate: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 20,
        }}
      >
        Все задания
      </div>
      {tasks.map((task) => {
        const emoji =
          task.done === true
            ? '✅'
            : task.done === false
              ? '❌'
              : resolveTaskEmoji(task);
        return (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 0',
              borderBottom: '1px solid rgba(var(--fg-rgb),0.05)',
            }}
          >
            <span
              style={{
                fontSize: 18,
                flexShrink: 0,
                width: 22,
                textAlign: 'center',
              }}
            >
              {emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {task.assignedBy !== null && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    marginBottom: 1,
                  }}
                >
                  от терапевта
                </div>
              )}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text)',
                  lineHeight: 1.35,
                }}
              >
                {resolveTaskDisplayText(task)}
              </div>
              <TaskProgressBar task={task} />
              {task.dueDate && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-sub)',
                    marginTop: 2,
                  }}
                >
                  до {fmtDate(task.dueDate)}
                </div>
              )}
            </div>
            {task.done === null &&
              task.assignedBy !== null &&
              task.type === 'custom' && (
                <button
                  onClick={() =>
                    api
                      .completeTask(task.id, true)
                      .then(() =>
                        Promise.all([
                          api.getTasks(),
                          api.getTaskHistory(),
                        ]).then(([t, h]) => {
                          setTasks(t);
                          setTaskHistory(h);
                        }),
                      )
                      .catch(() => {})
                  }
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: 10,
                    background:
                      'color-mix(in srgb, var(--accent-green) 14%, transparent)',
                    color: 'var(--accent-green)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Готово
                </button>
              )}
          </div>
        );
      })}
      {taskHistory.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              marginTop: 20,
              marginBottom: 8,
            }}
          >
            Выполнено
          </div>
          {taskHistory.map((task) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 0',
                borderBottom: '1px solid rgba(var(--fg-rgb),0.04)',
                opacity: 0.5,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  flexShrink: 0,
                  width: 22,
                  textAlign: 'center',
                }}
              >
                {task.done === true ? '✅' : '❌'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text)',
                    lineHeight: 1.35,
                  }}
                >
                  {resolveTaskDisplayText(task)}
                </div>
                {task.completedAt && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-sub)',
                      marginTop: 1,
                    }}
                  >
                    {fmtDate(
                      new Date(task.completedAt).toISOString().slice(0, 10),
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
      <button
        onClick={onOpenCreate}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '13px 0',
          borderRadius: 14,
          border: 'none',
          background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Поставить цель
      </button>
    </BottomSheet>
  );
}
