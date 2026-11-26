import type { DiaryType } from '../types';

export const DRAFT_KEYS: Record<DiaryType, string> = {
  schema: 'diary_draft_schema',
  mode: 'diary_draft_mode',
  gratitude: 'diary_draft_gratitude',
};

/** Черновики упражнений с текстом (useDraftAutosave): тот же формат, свои ключи. */
export const EXERCISE_DRAFT_KEYS = {
  letter: 'exercise_draft_letter',
  safePlace: 'exercise_draft_safe_place',
  beliefCheck: 'exercise_draft_belief_check',
  phraseCheck: 'exercise_draft_phrase_check',
} as const;

export interface DiaryDraft<T> {
  startedAt: string; // ISO
  data: T;
}

// Отказ хранилища не глотается молча (как в case/caseDraft.ts): в черновике
// лежит начатая человеком работа, сбой должен быть виден в консоли.
export function saveDraftAt<T>(key: string, data: T) {
  const draft: DiaryDraft<T> = { startedAt: new Date().toISOString(), data };
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (e) {
    console.error('draft save failed', key, e);
  }
}

export function loadDraftAt<T>(key: string): DiaryDraft<T> | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as DiaryDraft<T>) : null;
  } catch {
    return null;
  }
}

export function clearDraftAt(key: string) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('draft clear failed', key, e);
  }
}

export function saveDraft<T>(type: DiaryType, data: T) {
  saveDraftAt(DRAFT_KEYS[type], data);
}

export function loadDraft<T>(type: DiaryType): DiaryDraft<T> | null {
  return loadDraftAt<T>(DRAFT_KEYS[type]);
}

export function clearDraft(type: DiaryType) {
  clearDraftAt(DRAFT_KEYS[type]);
}

export function hasDraft(type: DiaryType): boolean {
  return !!localStorage.getItem(DRAFT_KEYS[type]);
}

export function formatDraftAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days > 0)
    return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`;
  if (hours > 0)
    return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`;
  if (mins > 0) return `${mins} мин. назад`;
  return 'только что';
}
