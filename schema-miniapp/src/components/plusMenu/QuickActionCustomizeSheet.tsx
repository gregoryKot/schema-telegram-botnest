// Лист «что показывать» — общий для «плюса» и «Инструментов»: строка —
// CustomizeRow (общая со ScreenCustomizeSheet), аналитика — quickActionRowHandlers.
import { CustomizeSheetShell } from '../CustomizeSheetShell';
import { CustomizeRow } from './CustomizeRow';
import { makeQuickActionRowHandlers } from './quickActionRowHandlers';
import type { QuickActionSurface } from '../../utils/quickActionPrefs';

interface CustomizeAction {
  id: string;
  emoji: string;
  label: string;
  sub: string;
  disabledUp: boolean;
  disabledDown: boolean;
}

interface Props {
  title: string;
  actions: CustomizeAction[];
  hidden: string[];
  surface: QuickActionSurface;
  onToggle: (id: string, hidden: boolean) => void;
  onMove: (id: string, dir: 'up' | 'down') => boolean;
  onClose: () => void;
}

export function QuickActionCustomizeSheet({
  title,
  actions,
  hidden,
  surface,
  onToggle,
  onMove,
  onClose,
}: Props) {
  const handlers = makeQuickActionRowHandlers(surface, onToggle, onMove);
  return (
    <CustomizeSheetShell
      title={title}
      subtitle="Скрытые пункты можно вернуть в любой момент"
      zIndex={300}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map((a) => {
          const wasHidden = hidden.includes(a.id);
          return (
            <CustomizeRow
              key={a.id}
              emoji={a.emoji}
              label={a.label}
              sub={a.sub}
              hidden={wasHidden}
              onToggle={() => handlers.handleToggle(a.id, wasHidden)}
              disabledUp={a.disabledUp}
              disabledDown={a.disabledDown}
              onMoveUp={() => handlers.handleMove(a.id, 'up')}
              onMoveDown={() => handlers.handleMove(a.id, 'down')}
            />
          );
        })}
      </div>
    </CustomizeSheetShell>
  );
}
