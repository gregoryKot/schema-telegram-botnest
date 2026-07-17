import { UserTask } from '../../api';
import { fmtDate } from '../../utils/format';
import { resolveTaskDisplayText } from './taskEmoji';

interface Props {
  taskHistory: UserTask[];
  /** full — карточка с рамкой (лист «Мои цели» в HelpSection),
   * compact — плоский список (лист «Все задания» на «Сегодня»). */
  variant?: 'full' | 'compact';
}

export function TaskHistoryList({ taskHistory, variant = 'full' }: Props) {
  if (taskHistory.length === 0) return null;
  const full = variant === 'full';

  return (
    <>
      <div
        style={{
          fontSize: full ? 11 : 10,
          fontWeight: 700,
          letterSpacing: full ? '0.10em' : '0.07em',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          marginTop: 20,
          marginBottom: full ? 10 : 8,
        }}
      >
        Выполнено
      </div>
      <div
        style={
          full
            ? {
                background: 'var(--surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 16,
                overflow: 'hidden',
              }
            : undefined
        }
      >
        {taskHistory.map((task, i) => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: full ? '11px 14px' : '9px 0',
              borderTop:
                full && i > 0 ? '1px solid var(--border-color)' : undefined,
              borderBottom: full
                ? undefined
                : '1px solid rgba(var(--fg-rgb),0.04)',
              opacity: full ? 0.6 : 0.5,
            }}
          >
            <span
              style={{
                fontSize: full ? 15 : 16,
                flexShrink: 0,
                width: full ? 20 : 22,
                textAlign: 'center',
              }}
            >
              {task.done === true ? '✅' : '❌'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: full ? 13 : 12,
                  color: 'var(--text)',
                  lineHeight: 1.35,
                }}
              >
                {resolveTaskDisplayText(task, variant)}
              </div>
              {task.completedAt && (
                <div
                  style={{
                    fontSize: 10,
                    color: full ? 'var(--text-faint)' : 'var(--text-sub)',
                    marginTop: full ? 2 : 1,
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
      </div>
    </>
  );
}
