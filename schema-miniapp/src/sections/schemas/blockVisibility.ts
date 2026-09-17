// Узкий тип видимости+порядка generic-блоков экрана (heroes/ysq_status на
// «Паттернах», Профиль — свой набор): нужны isHidden/holdProps/orderedIds,
// не весь хук useScreenBlocks (проще подделать в тестах).
import type { LongPressProps } from '../../hooks/useLongPress';
import type { ScreenBlockId } from '../../utils/screenBlocks';

export interface BlockVisibility {
  isHidden: (id: ScreenBlockId) => boolean;
  holdProps: (id: ScreenBlockId) => LongPressProps;
  orderedIds: ScreenBlockId[];
}
