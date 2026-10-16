import { MODE_GROUP_HUE, NEED_HUE } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';

/** Оттенок режима карточки «Мне плохо» по группам режимов из lib/tone. */
const MODE_HUE: Record<string, number> = {
  vulnerable_child: MODE_GROUP_HUE.child,
  angry_child: MODE_GROUP_HUE.child,
  detached: MODE_GROUP_HUE.coping_avoidance,
  critic: MODE_GROUP_HUE.critic,
};

export const flashcardModeHue = (id: string): number | undefined => MODE_HUE[id];
export const flashcardNeedHue = (id: string): number | undefined => NEED_HUE[id as NeedId];
