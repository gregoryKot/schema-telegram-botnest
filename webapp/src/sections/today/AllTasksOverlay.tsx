import type { UserTask } from '../../api';
import { GlyphArrowLeft } from '../../components/exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { fmtDate } from '../../utils/format';
import { resolveTaskText, resolveTaskEmoji } from './helpers';

// Оверлей «Все задания» экрана «Сегодня». Вынесено из TodaySection.tsx
// (правило №10). Поведение не менялось.
export function AllTasksOverlay({ tasks, taskHistory, onClose, onTaskDone, onAddTask }: {
  tasks: UserTask[];
  taskHistory: UserTask[];
  onClose: () => void;
  onTaskDone: (id: number) => void;
  onAddTask: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <div className="ex-topbar">
        <button className="ex-back" onClick={goBack}><GlyphArrowLeft /> Назад</button>
      </div>
      <div style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', marginBottom: 24 }}>Все задания</h1>
        {tasks.map(task => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 18, flexShrink: 0, width: 22, textAlign: 'center' }}>
              {task.done === true ? '✅' : task.done === false ? '❌' : resolveTaskEmoji(task)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {task.assignedBy !== null && <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 1 }}>от терапевта</div>}
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{resolveTaskText(task)}</div>
              {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>до {fmtDate(task.dueDate)}</div>}
            </div>
            {task.done === null && task.assignedBy !== null && task.type === 'custom' && (
              <button onClick={() => onTaskDone(task.id as number)}
                style={{ padding: '6px 12px', border: 'none', borderRadius: 10, background: 'color-mix(in srgb, var(--c-moss) 14%, transparent)', color: 'var(--c-moss)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                Готово
              </button>
            )}
          </div>
        ))}
        {taskHistory.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 20, marginBottom: 8 }}>Выполнено</div>
            {taskHistory.map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)', opacity: 0.5 }}>
                <span style={{ fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>{task.done === true ? '✅' : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.35 }}>{resolveTaskText(task)}</div>
                  {task.completedAt && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{fmtDate(new Date(task.completedAt).toISOString().slice(0, 10))}</div>}
                </div>
              </div>
            ))}
          </>
        )}
        <button onClick={onAddTask} className="ex-btn ex-btn-primary" style={{ marginTop: 20, width: '100%' }}>
          + Поставить цель
        </button>
      </div>
      </div>
    </div>
  );
}
