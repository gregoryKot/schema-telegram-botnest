// Узкий тип видимости generic-блоков экрана «Паттерны» (heroes/ysq_status):
// SchemasSection получает полный объект из useScreenBlocks('patterns', …) и
// передаёт его вниз через SchemasTab/ModesTab в *HeroSection — тем компонентам
// нужны только isHidden/holdProps, не весь хук (проще подделать в тестах).
import type { LongPressProps } from '../../hooks/useLongPress';
import type { ScreenBlockId } from '../../utils/screenBlocks';

export interface BlockVisibility {
  isHidden: (id: ScreenBlockId) => boolean;
  holdProps: (id: ScreenBlockId) => LongPressProps;
}
