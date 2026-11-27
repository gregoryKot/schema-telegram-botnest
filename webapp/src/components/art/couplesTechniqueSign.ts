import type { CouplesTechniqueId } from '../../../../shared/src/schemaTherapy/guide/techniqueIdsCouples';
import type { GuideSign } from './guideSignsModel';

export const COUPLES_TECHNIQUE_SIGN: Record<CouplesTechniqueId, GuideSign> = {
  need_vs_wish: 'need_wish',
  mutual_reparenting: 'mutual_hold',
  couple_friendship: 'friend_pair',
  couple_chairwork: 'couple_chairs',
};
