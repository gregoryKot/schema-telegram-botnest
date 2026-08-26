import { pressable } from '../../utils/a11y';
import { TASK_OPTIONS, type TaskType } from './options';

// Выбор типа задания — карточки каталога. Вынесено из TaskCreateSheet.tsx
// (правило №10).
export function TaskTypeSelector({
  type,
  onPick,
}: {
  type: TaskType;
  onPick: (t: TaskType) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 20,
      }}
    >
      {TASK_OPTIONS.map((opt) => (
        <div
          key={opt.type}
          {...pressable(() => onPick(opt.type))}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-12)',
            cursor: 'pointer',
            background:
              type === opt.type
                ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                : 'rgba(var(--fg-rgb),0.03)',
            border: `1px solid ${type === opt.type ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(var(--fg-rgb),0.07)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-10)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color:
                  type === opt.type
                    ? 'var(--accent)'
                    : 'rgba(var(--fg-rgb),0.8)',
              }}
            >
              {opt.label}
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}
            >
              {opt.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
