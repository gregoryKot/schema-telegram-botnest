export type DiaryType = 'schema' | 'mode' | 'gratitude';

export interface EmotionEntry {
  id: string;
  intensity: number; // 1-5
}

export interface SchemaDiaryEntry {
  id: number;
  createdAt: string;
  trigger: string;
  emotions: EmotionEntry[];
  thoughts?: string | null;
  bodyFeelings?: string | null;
  actualBehavior?: string | null;
  schemaIds: string[];
  schemaOrigin?: string | null;
  healthyView?: string | null;
  realProblems?: string | null;
  excessiveReactions?: string | null;
  healthyBehavior?: string | null;
}

export interface ModeDiaryEntry {
  id: number;
  createdAt: string;
  modeId: string;
  situation: string;
  thoughts?: string | null;
  feelings?: string | null;
  bodyFeelings?: string | null;
  actions?: string | null;
  actualNeed?: string | null;
  childhoodMemories?: string | null;
}

export interface GratitudeDiaryEntry {
  id: number;
  date: string;
  items: string[];
  createdAt: string;
}
