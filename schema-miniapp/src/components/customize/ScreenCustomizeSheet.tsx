// Лист «Настроить экран»: скрыть/показать + переставить блоки текущего
// экрана. Generic по CustomizableScreen («Профиль»/«Паттерны» — один
// компонент, правило «одна механика — компонент»). Строка — CustomizeRow,
// общая с QuickActionCustomizeSheet; порядок — withMoveFlags (тот же
// generic-примитив, что у меню «плюс»). Каркас — общий CustomizeSheetShell.
import { CustomizeSheetShell } from '../CustomizeSheetShell';
import { CustomizeRow } from '../plusMenu/CustomizeRow';
import { withMoveFlags, type MoveDir } from '../../utils/quickActionOrder';
import { BLOCK_META, type ScreenBlockId } from '../../utils/screenBlocks';

export interface ScreenBlocksApi {
  hidden: string[];
  orderedIds: ScreenBlockId[];
  highlight?: ScreenBlockId;
  toggle: (id: ScreenBlockId) => void;
  move: (id: string, dir: MoveDir) => boolean;
  closeSheet: () => void;
}

export function ScreenCustomizeSheet({ blocks }: { blocks: ScreenBlocksApi }) {
  const { hidden, orderedIds, highlight, toggle, move, closeSheet } = blocks;
  const rows = withMoveFlags(orderedIds.map((id) => ({ id })));
  return (
    <CustomizeSheetShell
      title="Настроить экран"
      subtitle="Скрытые блоки можно вернуть в любой момент"
      onClose={closeSheet}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ id, disabledUp, disabledDown }) => {
          const meta = BLOCK_META[id];
          if (!meta) return null;
          return (
            <CustomizeRow
              key={id}
              emoji={meta.emoji}
              label={meta.label}
              sub={meta.sub}
              hidden={hidden.includes(id)}
              onToggle={() => toggle(id)}
              disabledUp={disabledUp}
              disabledDown={disabledDown}
              onMoveUp={() => move(id, 'up')}
              onMoveDown={() => move(id, 'down')}
              highlighted={highlight === id}
            />
          );
        })}
      </div>
    </CustomizeSheetShell>
  );
}
