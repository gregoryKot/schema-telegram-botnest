import type { CSSProperties, ReactNode } from 'react';
import type { ScreenBlockId } from '../../../../shared/src/screens/screenBlocks';
import type { SiteScreenBlocks } from './useScreenBlocks';

interface Props {
  id: ScreenBlockId;
  blocks: Pick<SiteScreenBlocks, 'isHidden' | 'hold' | 'orderedIds'>;
  className?: string;
  children: ReactNode;
}

// Обёртка блока экрана, который можно скрыть и переставить («Профиль», «Паттерны»):
// скрытый блок не рисуется, на телефоне долгое нажатие открывает лист «Настроить
// экран» на его строке. Место блока в порядке — переменная --blk-o (на
// телефоне её читает css экрана и ставит в `order`; на десктопе порядок не
// меняется).
export function ScreenBlock({ id, blocks, className, children }: Props) {
  if (blocks.isHidden(id)) return null;
  const hold = blocks.hold(id);
  const style = { ...hold?.style, '--blk-o': blocks.orderedIds.indexOf(id) + 1 } as CSSProperties;
  return (
    <div {...hold} className={className} style={style}>
      {children}
    </div>
  );
}
