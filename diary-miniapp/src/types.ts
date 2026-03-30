export type DiaryType = 'schema' | 'mode' | 'gratitude';

export interface EmotionEntry {
  id: string;
  intensity: number; // 1-5
}

export interface SchemaDiaryEntry {
  id: number;
  createdAt: string;
  situation: string;
  emotions: EmotionEntry[];
  emotionNote?: string | null;
  bodyFeelings?: string | null;
  thoughts?: string | null;
  schemaIds: string[];
  copingModeId?: string | null;
  healthyAdult?: string | null;
}

export interface ModeDiaryEntry {
  id: number;
  createdAt: string;
  modeId: string;
  trigger: string;
  intensity: number;
  healthyAdult?: string | null;
}

export interface GratitudeDiaryEntry {
  id: number;
  date: string;
  items: string[];
  createdAt: string;
}
