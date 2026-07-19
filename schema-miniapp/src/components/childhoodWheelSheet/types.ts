export const CHILDHOOD_DONE_KEY = 'childhood_wheel_done';

export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}

export const NEED_IDS = [
  'attachment',
  'autonomy',
  'expression',
  'play',
  'limits',
] as const;
export type NeedId = (typeof NEED_IDS)[number];

export type NeedMetaEntry = {
  label: string;
  emoji: string;
  question: string;
  anchorLow: string;
  anchorHigh: string;
  examples: Array<{ score: number; text: string }>;
};

export type Phase = 'intro' | 'fill' | 'result';

export type Ratings = Record<NeedId, number>;

export type ActiveSchema = {
  name: string;
  desc: string;
  color: string;
};
