import { BottomSheet } from '../BottomSheet';
import { fmtDate } from '../../utils/format';
import { ClientDetail } from './types';

interface TasksSheetProps {
  detail: ClientDetail;
}

export function TasksSheet({ detail }: TasksSheetProps) {
  const { clientTasks, setShowTasksSheet, setShowAssign } = detail;

  return (
    <BottomSheet onClose={() => setShowTasksSheet(false)}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          📋 Задания
        </div>
        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.03)',
            border: '1px solid rgba(var(--fg-rgb),0.07)',
            borderRadius: 16,
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
            clientTasks.map((task, i) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 16px',
                  borderTop:
                    i > 0 ? '1px solid rgba(var(--fg-rgb),0.05)' : undefined,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {task.done === true
                    ? '✅'
                    : task.done === false
                      ? '❌'
                      : task.doneToday
                        ? '✅'
                        : '⏳'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--text)',
                      lineHeight: 1.4,
                    }}
                  >
                    {task.text}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-sub)',
                      marginTop: 3,
                    }}
                  >
                    {task.dueDate
                      ? `Срок: ${fmtDate(task.dueDate)}`
                      : fmtDate(task.createdAt.slice(0, 10))}
                  </div>
                  {task.progress !== undefined && task.targetDays && (
                    <div
                      style={{
                        marginTop: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: 'rgba(var(--fg-rgb),0.08)',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(task.progress / task.targetDays, 1) * 100}%`,
                            height: '100%',
                            background: 'var(--accent)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-sub)',
                          flexShrink: 0,
                        }}
                      >
                        {task.progress}/{task.targetDays}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => setShowAssign(true)}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
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
