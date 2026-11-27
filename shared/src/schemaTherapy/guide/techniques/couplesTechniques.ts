import type { TechniqueGuideBuilder } from '../types';
import { buildCoupleFriendshipTechniques } from './coupleFriendship';
import { buildMutualReparentingTechniques } from './mutualReparenting';

export { playAndJoyCouplesMore } from './playAndJoyCouples';

/** Техники книги о схема-терапии пар (карта «Пары»): подключены через childCare.ts. */
export const buildCouplesTechniques: TechniqueGuideBuilder = (tr) => [
  ...buildMutualReparentingTechniques(tr),
  ...buildCoupleFriendshipTechniques(tr),
];
