import { ActionRow } from './ActionRow';
import type { QuickAction, QuickActionId } from '../../utils/quickActions';

// Одна группа меню «плюс»: заголовок + строки действий. Вынесена из
// PlusMenuSheet.tsx, чтобы добавление порядка (стрелки живут в листе
// настройки, не тут) не раздувало сам лист сверх храповика размера.
export function PlusActionGroup({
  title,
  actions,
  onAction,
}: {
  title: string;
  actions: QuickAction[];
  onAction: (id: QuickActionId) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="section-label" style={{ margin: '0 4px 8px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map((a) => (
          <ActionRow
            key={a.id}
            label={a.label}
            sub={a.sub}
            onClick={() => onAction(a.id)}
          />
        ))}
      </div>
    </div>
  );
}
