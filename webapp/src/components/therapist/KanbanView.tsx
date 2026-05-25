import type { UserTask } from '../../api';
import { fmtDate } from '../../utils/format';

interface Props {
  allTasks: { clientId: number; clientName: string; tasks: UserTask[] }[] | null;
  loading: boolean;
  onOpenClient: (clientId: number) => void;
}

export function KanbanView({ allTasks, loading, onOpenClient }: Props) {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span className="eyebrow">{col.label}</span>
            {col.items.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: col.color, background: `color-mix(in srgb, ${col.color} 12%, transparent)`, borderRadius: 10, padding: '1px 8px' }}>
                {col.items.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {col.items.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>—</div>
            )}
            {col.items.map(task => (
              <div
                key={task.id}
                onClick={() => onOpenClient(task.userId)}
                style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', border: '1px solid var(--line)', transition: 'border-color 0.15s' }}
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
