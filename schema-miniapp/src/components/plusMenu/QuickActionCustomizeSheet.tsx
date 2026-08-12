// Лист «что показывать» — общий для «плюса» и «Инструментов»: строка —
// CustomizeRow (общая со ScreenCustomizeSheet), аналитика —
// quickActionRowHandlers, порядок — drag&drop (useQuickActionDragRows).
import { CustomizeSheetShell } from '../CustomizeSheetShell';
import { CustomizeRow } from './CustomizeRow';
import { useQuickActionDragRows } from './quickActionDragRows';
import { makeQuickActionRowHandlers } from './quickActionRowHandlers';
import type { QuickActionSurface } from '../../utils/quickActionPrefs';

interface CustomizeAction {
  id: string;
  label: string;
  sub: string;
  rangeMin: number;
  rangeMax: number;
}

interface Props {
  title: string;
  actions: CustomizeAction[];
  hidden: string[];
  surface: QuickActionSurface;
  onToggle: (id: string, hidden: boolean) => void;
  onReorder: (id: string, toIndex: number) => 'up' | 'down' | false;
  onClose: () => void;
}

export function QuickActionCustomizeSheet({
  title,
  actions,
  hidden,
  surface,
  onToggle,
  onReorder,
  onClose,
}: Props) {
  const handlers = makeQuickActionRowHandlers(surface, onToggle, onReorder);
  const { rowProps } = useQuickActionDragRows(actions, handlers.handleReorder);
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
              label={a.label}
              sub={a.sub}
              hidden={wasHidden}
              onToggle={() => handlers.handleToggle(a.id, wasHidden)}
              {...rowProps(a)}
            />
          );
        })}
      </div>
    </CustomizeSheetShell>
  );
}
