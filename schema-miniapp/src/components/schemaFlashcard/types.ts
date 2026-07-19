export interface FlashcardEntry {
  id: string | number;
  date: string;
  mode: string;
  reflection: string;
  needId: string;
  action: string;
}

export interface ModeData {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  response: string;
  color: string;
}

export interface NeedData {
  id: string;
  emoji: string;
  label: string;
}

export type Step = 'mode' | 'response' | 'need' | 'action';
