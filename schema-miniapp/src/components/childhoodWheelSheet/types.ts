import type { ChildhoodRatings } from '../../../../shared/src/childhoodWheel/childhoodWheel';

export const CHILDHOOD_DONE_KEY = 'childhood_wheel_done';

export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}

// Список и тип потребностей – из shared (единственный источник).
export { NEED_ORDER as NEED_IDS } from '../../../../shared/src/needs/types';
export type { NeedId } from '../../../../shared/src/needs/types';

export type NeedMetaEntry = {
  label: string;
  question: string;
  anchorLow: string;
  anchorHigh: string;
  examples: Array<{ score: number; text: string }>;
};

export type Phase = 'intro' | 'fill' | 'result';

export type Ratings = ChildhoodRatings;

export type ActiveSchema = {
  name: string;
  desc: string;
  color: string;
};
