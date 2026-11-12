import { SignArt } from '../../components/art/SignArt';
import type { ArtProps } from '../../components/art/paper';
import type { UserTask } from '../../api';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { taskEntity } from './taskEntity';

/**
 * Знак задания — знак его сущности из ENTITY_LOOK (docs/design/APP_2026-11.md, b20): трекер Strokes, дневник
 * Pebbles, схема и YSQ Layers, режим Cluster, колесо Wheel, убеждение Scales, письмо Sheets, безопасное место
 * Haven, «Мне плохо» Heart, своё — Check. До b20 знак выбирал местный switch и рисовал Check письму, безопасному
 * месту, убеждению и «Мне плохо» — четыре шалфейные галочки подряд на «Практиках» (ревью g4 r3).
 */
export function TaskSign({ task, size = 'row' }: { task: Pick<UserTask, 'type' | 'text'>; size?: ArtProps['size'] }) {
  return <SignArt sign={ENTITY_LOOK[taskEntity(task)].sign} size={size} />;
}
