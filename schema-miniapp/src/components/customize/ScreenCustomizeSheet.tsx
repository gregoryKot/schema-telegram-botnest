// Лист «Настроить экран»: скрыть/показать + переставить (drag&drop) блоки
// экрана. Строка — CustomizeRow, общая с QuickActionCustomizeSheet; порядок —
// useDragReorder (тот же примитив, что у меню «плюс»/«Инструментов»).
import type { ScreenBlocksApi } from '../../../../shared/src/screens/useScreenBlocks';
import { CustomizeSheetShell } from '../CustomizeSheetShell';
import { CustomizeRow } from '../plusMenu/CustomizeRow';
import { useDragReorder } from '../../../../shared/src/hooks/useDragReorder';
import { BLOCK_META } from '../../utils/screenBlocks';

export type { ScreenBlocksApi };

export function ScreenCustomizeSheet({ blocks }: { blocks: ScreenBlocksApi }) {
  const { hidden, orderedIds, highlight, toggle, reorder, closeSheet } = blocks;
  const d = useDragReorder({ ids: orderedIds, onReorder: reorder });
  const range = { min: 0, max: orderedIds.length - 1 };
  return (
    <CustomizeSheetShell
      title="Настроить экран"
      subtitle="Скрытые блоки можно вернуть в любой момент"
      onClose={closeSheet}
    >
      <div className="u-col8">
        {orderedIds.map((id) => {
          const meta = BLOCK_META[id];
          if (!meta) return null;
          return (
            <CustomizeRow
              key={id}
              label={meta.label}
              sub={meta.sub}
              hidden={hidden.includes(id)}
              onToggle={() => toggle(id)}
              dragHandleProps={d.handleProps(id, meta.label, range)}
              rowRef={d.registerRow(id)}
              drag={{ offsetY: d.offsetFor(id), lifted: d.drag?.id === id }}
              highlighted={highlight === id}
            />
          );
        })}
      </div>
    </CustomizeSheetShell>
  );
}
