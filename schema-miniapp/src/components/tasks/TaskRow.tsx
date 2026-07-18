import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import { UserTask } from '../../api';
import { fmtDate } from '../../utils/format';
import { resolveTaskDisplayText, resolveTaskEmoji } from './taskEmoji';
import { TaskProgressBar } from './TaskProgressBar';

interface Props {
  task: UserTask;
  /** Обязателен для variant="full" (компакт-строка тапом не открывается). */
  onOpen?: () => void;
  onComplete?: () => void;
  /**
   * full — карточка-строка с иконкой-бабблом, тапабельна целиком, кликом
   * открывает задачу (лист «Мои цели» в HelpSection).
   * compact — плотная строка без баббла, не открывается тапом (список
   * задач на «Сегодня»).
   */
  variant?: 'full' | 'compact';
}

export function TaskRow({ task, onOpen, onComplete, variant = 'full' }: Props) {
  if (variant === 'compact')
    return <CompactTaskRow task={task} onComplete={onComplete} />;
  return (
    <FullTaskRow
      task={task}
      onOpen={onOpen ?? (() => {})}
      onComplete={onComplete}
    />
  );
}

function FullTaskRow({
  task,
  onOpen,
  onComplete,
}: {
  task: UserTask;
  onOpen: () => void;
  onComplete?: () => void;
}) {
  const isStreakTask =
    task.type === 'diary_streak' || task.type === 'tracker_streak';
  const isAssigned = task.assignedBy !== null;
  const [completing, setCompleting] = useState(false);
  const emoji = task.doneToday ? '✅' : resolveTaskEmoji(task);
  const showComplete =
    !task.doneToday &&
    task.done === null &&
    task.type === 'custom' &&
    !!onComplete;

  return (
    <div
      {...(task.doneToday ? {} : pressable(onOpen))}
      style={{
        padding: '14px',
        background: 'var(--surface)',
        border: `1px solid ${isAssigned && !task.doneToday ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border-color)'}`,
        borderRadius: 16,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: task.doneToday ? 'default' : 'pointer',
        opacity: task.doneToday ? 0.55 : 1,
        transition: 'all 0.15s',
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          flexShrink: 0,
          background: task.doneToday
            ? 'rgba(52,211,153,0.1)'
            : 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 19,
        }}
      >
        {emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isAssigned && !task.doneToday && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            от терапевта
          </div>
        )}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text)',
            lineHeight: 1.35,
          }}
        >
          {resolveTaskDisplayText(task, 'full')}
        </div>
        {task.doneToday && isStreakTask && (
          <div
            style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 3 }}
          >
            Сделано сегодня — завтра снова
          </div>
        )}
        <TaskProgressBar task={task} />
        {task.dueDate && (
          <div
            style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}
          >
            до {fmtDate(task.dueDate)}
          </div>
        )}
      </div>

      {showComplete ? (
        <button
          disabled={completing}
          onClick={(e) => {
            e.stopPropagation();
            setCompleting(true);
            onComplete();
          }}
          style={{
            background: 'rgba(52,211,153,0.12)',
            outline: '1px solid rgba(52,211,153,0.22)',
            border: 'none',
            borderRadius: 10,
            padding: '7px 12px',
            color: 'var(--accent-green)',
            fontSize: 12,
            fontWeight: 600,
            cursor: completing ? 'default' : 'pointer',
            flexShrink: 0,
            opacity: completing ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          {completing ? '...' : 'Готово'}
        </button>
      ) : !task.doneToday && task.type !== 'custom' ? (
        <span
          style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}
        >
          ›
        </span>
      ) : null}
    </div>
  );
}

function CompactTaskRow({
  task,
  onComplete,
}: {
  task: UserTask;
  onComplete?: () => void;
}) {
  const emoji =
    task.done === true
      ? '✅'
      : task.done === false
        ? '❌'
        : resolveTaskEmoji(task);
  const showComplete =
    task.done === null &&
    task.assignedBy !== null &&
    task.type === 'custom' &&
    !!onComplete;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 0',
        borderBottom: '1px solid rgba(var(--fg-rgb),0.05)',
      }}
    >
      <span
        style={{ fontSize: 18, flexShrink: 0, width: 22, textAlign: 'center' }}
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
          {resolveTaskDisplayText(task, 'compact')}
        </div>
        <TaskProgressBar task={task} dense />
        {task.dueDate && (
          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>
            до {fmtDate(task.dueDate)}
          </div>
        )}
      </div>
      {showComplete && (
        <button
          onClick={onComplete}
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
}
