// Лист «что показывать в плюсе»: тумблер и ручка «≡» на каждое действие, как в
// мини-аппе. Хранение, ключи и аналитика — общие (shared/src/quickActions),
// строка листа — та же CustomizeRow, что у «Настроить экран».
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { makeQuickActionRowHandlers } from '../../../../shared/src/quickActions/quickActionRowHandlers';
import { withDragRange } from '../../../../shared/src/quickActions/quickActionOrder';
import { useQuickActionDragRows } from '../../../../shared/src/quickActions/useQuickActionDragRows';
import type { QuickActionGroup } from '../../../../shared/src/quickActions/quickActions';
import { CustomizeRow } from '../customize/CustomizeRow';
import { CustomizeSheetFrame } from '../customize/CustomizeSheetFrame';
import { ReorderHint } from '../customize/ReorderHint';

interface Props {
  groups: QuickActionGroup[];
  hidden: string[];
  onToggle: (id: string, hidden: boolean) => void;
  onReorder: (id: string, toIndex: number) => 'up' | 'down' | false;
  onClose: () => void;
}

export function QuickActionCustomizeSheet({ groups, hidden, onToggle, onReorder, onClose }: Props) {
  const tr = useTr();
  const handlers = makeQuickActionRowHandlers('plus', onToggle, onReorder, api);
  const flat = withDragRange(groups.map((g) => g.actions));
  const { rowProps } = useQuickActionDragRows(flat, handlers.handleReorder);
  const sections = groups.map((g, i) => {
    const start = groups.slice(0, i).reduce((n, prev) => n + prev.actions.length, 0);
    return { id: g.id, title: g.title, items: flat.slice(start, start + g.actions.length) };
  });
  return (
    <CustomizeSheetFrame title="Что показывать в «+»" subtitle="Скрытые пункты можно вернуть в любой момент" onClose={onClose}>
      {() => (
        <>
          <ReorderHint tr={tr} phone noun="пунктов" />
          {sections.map((g) => (
            <div key={g.id}>
              <div className="ds-label cz-group">{g.title}</div>
              <div className="cz-card">
                {g.items.map((a) => {
                  const wasHidden = hidden.includes(a.id);
                  const { dragHandleProps, rowRef, drag } = rowProps(a);
                  return (
                    <CustomizeRow
                      key={a.id}
                      title={a.label}
                      sub={a.sub}
                      on={!wasHidden}
                      onToggle={() => handlers.handleToggle(a.id, wasHidden)}
                      handle={dragHandleProps}
                      rowRef={rowRef}
                      offsetY={drag.offsetY}
                      lifted={drag.lifted}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </CustomizeSheetFrame>
  );
}
