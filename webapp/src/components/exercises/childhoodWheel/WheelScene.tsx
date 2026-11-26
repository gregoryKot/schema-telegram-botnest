import type { NeedId } from '../../../../../shared/src/needs/types';
import { SceneChildhood } from '../../art/LandingScenes';
import { WHEEL_FILLS, wheelValues } from './wheelSceneModel';

/** Колесо по оценкам — сцена лендинга «шаг 01» с данными (wheelSceneModel.ts). Обёртка с классом chw-scene:
 *  по нему лист-герой ставит сцену крупно (sheet-childhood.css), а не углом, как знак сущности. */
export function WheelScene({ ratings, unrated, className }: {
  ratings: Partial<Record<NeedId, number>>;
  unrated?: readonly NeedId[];
  className?: string;
}) {
  return (
    <span className={className ? `chw-scene ${className}` : 'chw-scene'}>
      <SceneChildhood values={wheelValues(ratings, unrated)} fills={WHEEL_FILLS} />
    </span>
  );
}
