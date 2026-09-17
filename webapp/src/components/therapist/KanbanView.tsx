import type { UserTask } from '../../api';
import { fmtDate } from '../../utils/format';
import { pressable } from '../../utils/a11y';

interface Props {
  allTasks: { clientId: number; clientName: string; tasks: UserTask[] }[] | null;
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  onOpenClient: (clientId: number) => void;
}

export function KanbanView({ allTasks, loading, loadFailed, onRetry, onOpenClient }: Props) {
  if (loadFailed) {
    // Сбой ≠ пусто: без этой ветки отказ запроса рисовал бы терапевту
    // пустую доску («Назначенных заданий пока нет») вместо явной ошибки.
    return (
      <div role="alert" style={{ padding: '24px 0' }}>
        <p style={{ color: 'var(--c-rose)', fontSize: 14, margin: '0 0 12px' }}>Не удалось загрузить задания</p>
        <button onClick={onRetry} style={{
          padding: '8px 18px', background: 'transparent', border: '1.5px solid var(--c-rose)', color: 'var(--c-rose)',
          borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Попробовать ещё раз
        </button>
      </div>
    );
  }
  if (loading || !allTasks) {
    return <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-faint)' }}>Загрузка...</div>;
  }

  const flat = allTasks.flatMap(group =>
    group.tasks.map(t => ({ ...t, clientName: group.clientName }))
  );

  if (flat.length === 0) {
    return (
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="text-md muted">Назначенных заданий пока нет</div>
      </div>
    );
  }

  const pending   = flat.filter(t => t.done === null);
  const completed = flat.filter(t => t.done === true);
  const failed    = flat.filter(t => t.done === false);

  const cols: { label: string; items: typeof flat; color: string }[] = [
    { label: 'Назначено',  items: pending,   color: 'var(--accent)' },
    { label: 'Выполнено',  items: completed, color: 'var(--c-moss)' },
    { label: 'Не вышло',   items: failed,    color: 'var(--c-rose)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
      {cols.map(col => (
        <div key={col.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 14 }}>
            <span className="eyebrow">{col.label}</span>
            {col.items.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: col.color, background: `color-mix(in srgb, ${col.color} 12%, transparent)`, borderRadius: 'var(--r-10)', padding: '1px 8px' }}>
                {col.items.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            {col.items.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>–</div>
            )}
            {col.items.map(task => (
              <div
                key={task.id}
                {...pressable(() => onOpenClient(task.userId))}
                style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-10)', padding: '12px 14px', cursor: 'pointer', border: '1px solid var(--line)', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = col.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: col.color, marginBottom: 6 }}>{task.clientName}</div>
                <div className="text-sm" style={{ lineHeight: 1.5, color: 'var(--text)' }}>{task.text}</div>
                {task.dueDate && (
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>до {fmtDate(task.dueDate)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
