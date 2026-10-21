// Лист «Настроить экран» для экранов с generic-блоками («Профиль», «Паттерны»):
// скрыть/показать и переставить блоки из реестра shared/screens/screenBlocks.
// Состояние — shared/screens/useScreenBlocks, перестановка — useDragReorder.
import { useIsMobile } from '../useIsMobile';
import { useTr } from '../../utils/addressForm';
import { useDragReorder } from '../../../../shared/src/hooks/useDragReorder';
import { BLOCK_META } from '../../../../shared/src/screens/screenBlocks';
import type { ScreenBlocksApi } from '../../../../shared/src/screens/useScreenBlocks';
import { CustomizeRow } from './CustomizeRow';
import { CustomizeSheetFrame } from './CustomizeSheetFrame';
import { ReorderHint } from './ReorderHint';

export type { ScreenBlocksApi };

export function ScreenCustomizeSheet({ blocks }: { blocks: ScreenBlocksApi }) {
  const { hidden, orderedIds, highlight, toggle, reorder, closeSheet } = blocks;
  const tr = useTr();
  const phone = useIsMobile();
  const ids = orderedIds.filter((id) => BLOCK_META[id]);
  const drag = useDragReorder({ ids, onReorder: reorder });
  const range = { min: 0, max: ids.length - 1 };
  return (
    <CustomizeSheetFrame title="Настроить экран" subtitle="Скрытые блоки можно вернуть в любой момент" onClose={closeSheet}>
      {() => (
        <>
          <ReorderHint tr={tr} phone={phone} />
          <div className="cz-card">
            {ids.map((id) => {
              const meta = BLOCK_META[id]!;
              return (
                <CustomizeRow
                  key={id}
                  title={meta.label}
                  sub={meta.sub}
                  on={!hidden.includes(id)}
                  onToggle={() => toggle(id)}
                  handle={phone ? drag.handleProps(id, meta.label, range) : undefined}
                  rowRef={drag.registerRow(id)}
                  offsetY={drag.offsetFor(id)}
                  lifted={drag.drag?.id === id}
                  highlighted={highlight === id}
                />
              );
            })}
          </div>
        </>
      )}
    </CustomizeSheetFrame>
  );
}
